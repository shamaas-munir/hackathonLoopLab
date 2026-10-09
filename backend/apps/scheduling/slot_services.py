"""Admin exam slot rules: R17 (chosen slots are protected, D2) and R18 (slot validation, D14, D15)."""

from datetime import date, time

from django.db import transaction
from django.utils import timezone

from apps.scheduling.models import ExamSlot, SlotSeat
from common.exceptions import AppError
from common.models import Status
from common.time import combine, is_past

DUPLICATE_MESSAGE = "This course already has a slot at that date and time."


def validate_slot(course, day: date, start: time, end: time | None, instance: ExamSlot | None = None) -> dict:
    """Returns model fields for the slot or raises AppError with field errors."""
    errors = {}
    is_new_course = instance is None or instance.course_id != course.pk
    if is_new_course and course.status != Status.ACTIVE:
        errors["course"] = "This course is inactive. Activate it before adding slots."
    start_at = combine(day, start)
    end_at = combine(day, end) if end else None
    if day < timezone.localdate():
        errors["date"] = "Pick today or a later date."
    elif is_past(start_at):
        errors["start_time"] = "This time has already passed today."
    if end_at and end_at <= start_at:
        errors["end_time"] = "End time must be after the start time."
    if errors:
        raise AppError("VALIDATION", next(iter(errors.values())), 422, errors)

    duplicates = ExamSlot.objects.filter(course=course, start_at=start_at)
    if instance:
        duplicates = duplicates.exclude(pk=instance.pk)
    if duplicates.exists():
        raise AppError("CONFLICT", DUPLICATE_MESSAGE, 409, {"start_time": DUPLICATE_MESSAGE})
    return {"course": course, "start_at": start_at, "end_at": end_at}


def ensure_not_chosen(slot: ExamSlot) -> None:
    chosen = slot.selections.count()
    if chosen:
        students = "1 student has" if chosen == 1 else f"{chosen} students have"
        raise AppError("IN_USE", f"{students} chosen this slot. It can't be changed.", 409)


def update_slot(slot: ExamSlot, fields: dict) -> ExamSlot:
    with transaction.atomic():
        for name, value in fields.items():
            setattr(slot, name, value)
        slot.save()
        # Seat counters copy the capacity; nobody has booked yet because chosen slots can't be edited.
        SlotSeat.objects.filter(slot=slot).update(capacity=slot.capacity_per_branch)
    return slot


def delete_slot(slot: ExamSlot) -> None:
    ensure_not_chosen(slot)
    slot.delete()  # PROTECT on selections still blocks a student who chose it a moment ago
