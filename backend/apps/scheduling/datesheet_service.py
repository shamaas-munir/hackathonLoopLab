"""Date sheet designer reads and the save transaction (SYSTEM_DESIGN "The save transaction").

Rules: R2 (4-6 courses), R7 (save once), R8 (slot belongs to course), R9 (every course chosen),
R10 (no overlaps), R11 (unlock is single use), R22 (seat capacity per branch).
"""

from collections import defaultdict
from itertools import combinations

from django.conf import settings
from django.db import transaction
from django.db.models import F, OuterRef, Q, Subquery

from apps.scheduling.models import DatesheetSelection, ExamSlot, SlotSeat
from apps.scheduling.seats import release_seat, reserve_seat
from apps.students.models import CourseAssignment, Student
from apps.students.state import MAX_COURSES, MIN_COURSES
from common.emails import queue_email
from common.exceptions import AppError
from common.time import is_past, local, now, overlaps, slot_end, slot_range


def _invalid(message: str, code: str = "VALIDATION"):
    return AppError(code, message, 422, {"selections": message})


def _require_ready(student: Student, assignment_count: int) -> None:
    if not student.branch_id:
        raise AppError("VALIDATION", "Select your exam branch first.", 422)
    if not MIN_COURSES <= assignment_count <= MAX_COURSES:
        raise AppError(
            "ASSIGNMENT_INCOMPLETE",
            f"Your course assignment is incomplete ({assignment_count} of minimum {MIN_COURSES}). "
            "Please contact the administration.",
            403,
        )


def _slot_label(slot: ExamSlot) -> str:
    start, end = local(slot.start_at), local(slot_end(slot.start_at, slot.end_at))
    return f"{start:%a %d %b}, {start:%H:%M} to {end:%H:%M}"


# --- Designer: courses with their upcoming slots ---------------------------------------------------


def _slot_payload(slot: ExamSlot) -> dict:
    if slot.capacity_per_branch is None:
        left = None
    else:
        capacity = slot.seat_capacity if slot.seat_capacity is not None else slot.capacity_per_branch
        left = max(capacity - (slot.seat_booked or 0), 0)
    return {
        "id": slot.pk,
        "start_at": slot.start_at,
        "end_at": slot_end(slot.start_at, slot.end_at),
        "day": f"{local(slot.start_at):%A}",
        "seats_left": left,
    }


def courses_with_slots(student: Student) -> list[dict]:
    assignments = list(CourseAssignment.objects.filter(student=student).select_related("course"))
    _require_ready(student, len(assignments))

    selected = dict(DatesheetSelection.objects.filter(student=student).values_list("course_id", "slot_id"))
    seat = SlotSeat.objects.filter(slot=OuterRef("pk"), branch_id=student.branch_id)
    # Same numbers as seats.seats_left, computed for every slot in one query instead of one per slot.
    slots = (
        ExamSlot.objects.filter(course__in=[a.course_id for a in assignments])
        .filter(Q(start_at__gt=now()) | Q(pk__in=selected.values()))
        .annotate(
            seat_booked=Subquery(seat.values("booked")[:1]),
            seat_capacity=Subquery(seat.values("capacity")[:1]),
        )
        .order_by("start_at")
    )

    by_course: dict = {}
    for slot in slots:
        payload = _slot_payload(slot)
        # BN-1: a full slot is hidden unless it is the student's current choice.
        if payload["seats_left"] == 0 and selected.get(slot.course_id) != slot.pk:
            continue
        by_course.setdefault(slot.course_id, []).append(payload)

    return [
        {
            "course": a.course,
            "slots": by_course.get(a.course_id, []),
            "selected_slot": selected.get(a.course_id),
        }
        for a in assignments
    ]


# --- Saved date sheet ------------------------------------------------------------------------------


def datesheet(student: Student) -> dict:
    student = Student.objects.select_related("program", "branch").get(pk=student.pk)
    if student.datesheet_saved_at is None:
        raise AppError("NOT_FOUND", "You have not saved a date sheet yet.", 404)
    selections = DatesheetSelection.objects.filter(student=student).select_related("course", "slot")
    rows = sorted(selections, key=lambda s: s.slot.start_at)
    return {
        "full_name": student.full_name,
        "registration_no": student.registration_no,
        "program": student.program.name,
        "semester": student.semester,
        "session": student.session,
        "branch": student.branch,
        "saved_at": student.datesheet_saved_at,
        "locked": not student.datesheet_unlocked,
        "rows": [
            {
                "course_code": s.course.code,
                "course_title": s.course.title,
                "credit_hours": s.course.credit_hours,
                "start_at": s.slot.start_at,
                "end_at": slot_end(s.slot.start_at, s.slot.end_at),
                "day": f"{local(s.slot.start_at):%A}",
            }
            for s in rows
        ],
    }


# --- The save transaction --------------------------------------------------------------------------


def _validate_choices(assigned: dict, chosen: dict, slots: dict, current: dict) -> None:
    """R9, R8, past-slot and R10 checks. `assigned` maps course id -> code."""
    missing = sorted(code for course, code in assigned.items() if course not in chosen)
    if missing:
        raise _invalid(f"Pick a slot for every course. Missing: {', '.join(missing)}.")
    if set(chosen) - set(assigned):
        raise _invalid("You can only schedule the courses assigned to you.")

    for course_id, slot_id in chosen.items():
        slot = slots.get(slot_id)
        if slot is None or slot.course_id != course_id:
            raise _invalid(f"The selected slot is not available for {assigned[course_id]}.")
        if is_past(slot.start_at) and current.get(course_id) != slot_id:
            raise _invalid(f"The selected {assigned[course_id]} slot has already passed. Pick another time.")

    picked = sorted((slots[s] for s in chosen.values()), key=lambda s: s.start_at)
    clashes = [
        f"{a.course.code} and {b.course.code} overlap on {_slot_label(a)}"
        for a, b in combinations(picked, 2)
        if overlaps(a.start_at, a.end_at, b.start_at, b.end_at)
    ]
    if clashes:
        raise _invalid("; ".join(clashes) + ".", code="SLOT_CONFLICT")


def _apply_seat_changes(old: list[DatesheetSelection], new_slots: list[ExamSlot], branch) -> None:
    """R22: release dropped seats and reserve new ones; unchanged choices keep their seat. Seat rows
    are touched in ascending (slot id, branch id) order so concurrent saves can never deadlock."""
    changes: dict[tuple, int] = defaultdict(int)
    slots, branches = {}, {branch.pk: branch}
    for selection in old:
        changes[(selection.slot_id, selection.branch_id)] -= 1
        slots[selection.slot_id], branches[selection.branch_id] = selection.slot, selection.branch
    for slot in new_slots:
        changes[(slot.pk, branch.pk)] += 1
        slots[slot.pk] = slot

    for (slot_id, branch_id), change in sorted(changes.items()):
        if change < 0:
            release_seat(slots[slot_id], branches[branch_id])
        elif change > 0:
            reserve_seat(slots[slot_id], branches[branch_id])


def save_datesheet(student: Student, selections: list[dict]) -> None:
    with transaction.atomic():
        student = Student.objects.select_for_update(of=("self",)).select_related("user", "branch").get(pk=student.pk)
        assigned = dict(
            CourseAssignment.objects.filter(student=student).values_list("course_id", "course__code")
        )
        _require_ready(student, len(assigned))
        if student.datesheet_saved_at and not student.datesheet_unlocked:
            raise AppError(
                "LOCKED", "Your date sheet is already saved and locked. Raise a change request from Need Help.", 409
            )

        chosen = {item["course"]: item["slot"] for item in selections}
        if len(chosen) != len(selections):
            raise _invalid("Each course can have only one slot.")
        slots = ExamSlot.objects.select_related("course").in_bulk(list(chosen.values()))
        old = list(DatesheetSelection.objects.filter(student=student).select_related("slot__course", "branch"))
        _validate_choices(assigned, chosen, slots, {s.course_id: s.slot_id for s in old})

        new_slots = [slots[slot_id] for slot_id in chosen.values()]
        _apply_seat_changes(old, new_slots, student.branch)

        DatesheetSelection.objects.filter(student=student).delete()
        # The no_overlapping_exams exclusion constraint is the final guard; the exception handler
        # turns its IntegrityError into a 409 SLOT_CONFLICT.
        DatesheetSelection.objects.bulk_create(
            DatesheetSelection(
                student=student,
                course_id=slot.course_id,
                slot=slot,
                branch_id=student.branch_id,
                during=slot_range(slot.start_at, slot.end_at),
            )
            for slot in new_slots
        )
        Student.objects.filter(pk=student.pk).update(
            datesheet_saved_at=now(), datesheet_unlocked=False, version=F("version") + 1
        )
        queue_email(
            student.user.email,
            "datesheet_saved",
            {"name": student.full_name, "link": f"{settings.FRONTEND_URL}/student/datesheet"},
        )
