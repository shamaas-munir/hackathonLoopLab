"""Admin student management and course assignment (R1, R3, R4, R15, D3, D10, D15).

Every assignment change locks the student row first, so parallel admin edits can't push a student
past 6 courses or below 4, and can't slip in after the date sheet was saved.
"""

from django.core.files.storage import default_storage
from django.db import transaction

from apps.accounts.models import Role, User
from apps.accounts.services import send_account_setup_email
from apps.courses.models import Course
from apps.scheduling.models import DatesheetSelection
from apps.scheduling.seats import release_seat
from apps.students.models import CourseAssignment, Student
from apps.students.serializers import account_status
from apps.students.state import MAX_COURSES, MIN_COURSES
from common import audit
from common.exceptions import AppError
from common.models import Status

LOCKED_MESSAGE = "Date sheet already saved. Changes need an approved date sheet change request."


# --- Students ---------------------------------------------------------------------------------


def _ensure_unique(email=None, cnic=None, registration_no=None, student=None):
    """Answer 409 with every clashing field at once (the DB constraints remain the backstop)."""
    errors = {}
    others = Student.objects.exclude(pk=student.pk) if student else Student.objects.all()
    if email and User.objects.filter(email__iexact=email).exclude(pk=student.user_id if student else None).exists():
        errors["email"] = "A user with this email already exists."
    if cnic and others.filter(cnic=cnic).exists():
        errors["cnic"] = "A student with this CNIC already exists."
    if registration_no and others.filter(registration_no=registration_no).exists():
        errors["registration_no"] = "This registration number already exists."
    if errors:
        raise AppError("CONFLICT", next(iter(errors.values())), 409, errors)


@transaction.atomic
def create_student(actor, data: dict) -> Student:
    data = dict(data)
    email = data.pop("email")
    data.pop("version", None)
    _ensure_unique(email, data.get("cnic"), data.get("registration_no"))
    user = User.objects.create_user(email, role=Role.STUDENT)  # unusable password until the link is used
    student = Student.objects.create(user=user, **data)
    send_account_setup_email(user)
    audit.log_audit(actor, audit.CREATE, student)
    return student


@transaction.atomic
def update_student(actor, student_id, data: dict) -> Student:
    data = dict(data)
    student = Student.objects.select_for_update().select_related("user").filter(pk=student_id).first()
    if student is None:
        raise AppError("NOT_FOUND", "Student not found.", 404)
    if data.pop("version") != student.version:
        raise AppError("CONFLICT", "Record changed, reload to see the latest version.", 409)

    email = data.pop("email", None)
    _ensure_unique(email, data.get("cnic"), data.get("registration_no"), student=student)
    changed = sorted(field for field, value in data.items() if getattr(student, field) != value)
    if email and email != student.user.email:
        student.user.email = email
        student.user.save(update_fields=["email"])
        changed.append("email")

    old_photo = student.photo.name
    for field, value in data.items():
        setattr(student, field, value)
    student.version += 1
    student.save()
    if "photo" in data and old_photo and old_photo != student.photo.name:
        transaction.on_commit(lambda: default_storage.delete(old_photo))

    audit.log_audit(actor, audit.UPDATE, student, {"fields": changed})
    return student


@transaction.atomic
def delete_student(actor, student: Student) -> None:
    """D10: assignments, selections and requests cascade. Seats held by the date sheet are released."""
    for selection in DatesheetSelection.objects.filter(student=student).select_related("slot", "branch"):
        release_seat(selection.slot, selection.branch)
    photo = student.photo.name
    audit.log_audit(actor, audit.DELETE, str(student), {"id": str(student.pk)})
    student.user.delete()  # cascades to the Student row
    if photo:
        transaction.on_commit(lambda: default_storage.delete(photo))


def resend_invite(actor, student: Student) -> None:
    if account_status(student.user) != "invited":
        raise AppError("CONFLICT", "Already activated. They can use Forgot password.", 409)
    with transaction.atomic():
        send_account_setup_email(student.user)
        audit.log_audit(actor, audit.UPDATE, student, {"invite": "resent"})


# --- Course assignments -----------------------------------------------------------------------


def _lock_student(student_id) -> Student:
    student = Student.objects.select_for_update().filter(pk=student_id).first()
    if student is None:
        raise AppError("NOT_FOUND", "Student not found.", 404)
    if student.datesheet_saved_at is not None and not student.datesheet_unlocked:
        raise AppError("LOCKED", LOCKED_MESSAGE, 409)  # R4 / D3
    return student


def _new_courses(course_ids) -> list[Course]:
    """Courses being newly assigned: they must exist and be active (D15)."""
    courses = list(Course.objects.filter(pk__in=course_ids))
    if len(courses) != len(set(course_ids)):
        raise AppError("VALIDATION", "One or more courses were not found.", 422, {"course_ids": "Unknown course."})
    inactive = sorted(c.code for c in courses if c.status != Status.ACTIVE)
    if inactive:
        message = f"Inactive courses can't be assigned: {', '.join(inactive)}."
        raise AppError("VALIDATION", message, 422, {"course_ids": message})
    return courses


def _drop_selections(student: Student, course_ids) -> None:
    """When an unlocked date sheet loses a course, its chosen slot goes too and the seat is freed."""
    selections = DatesheetSelection.objects.filter(student=student, course_id__in=course_ids)
    for selection in selections.select_related("slot", "branch"):
        release_seat(selection.slot, selection.branch)
    selections.delete()


def _codes(course_ids) -> list[str]:
    return sorted(Course.objects.filter(pk__in=course_ids).values_list("code", flat=True))


@transaction.atomic
def replace_courses(actor, student_id, course_ids) -> Student:
    """Set the student's courses to exactly `course_ids` (4 to 6, validated by the serializer)."""
    student = _lock_student(student_id)
    current = set(student.assignments.values_list("course_id", flat=True))
    wanted = set(course_ids)
    added, removed = wanted - current, current - wanted

    courses = _new_courses(added)
    _drop_selections(student, removed)
    student.assignments.filter(course_id__in=removed).delete()
    CourseAssignment.objects.bulk_create(CourseAssignment(student=student, course=c) for c in courses)

    if added or removed:
        details = {"assignments": {"added": sorted(c.code for c in courses), "removed": _codes(removed)}}
        audit.log_audit(actor, audit.UPDATE, student, details)
    return student


@transaction.atomic
def add_course(actor, student_id, course_id) -> Student:
    student = _lock_student(student_id)
    assigned = set(student.assignments.values_list("course_id", flat=True))
    if course_id in assigned:
        raise AppError("CONFLICT", "Course already assigned.", 409, {"course_id": "Course already assigned."})
    if len(assigned) >= MAX_COURSES:
        message = f"A student can have at most {MAX_COURSES} courses."
        raise AppError("VALIDATION", message, 422, {"course_id": message})

    (course,) = _new_courses([course_id])
    CourseAssignment.objects.create(student=student, course=course)
    audit.log_audit(actor, audit.UPDATE, student, {"assignments": {"added": [course.code]}})
    return student


@transaction.atomic
def remove_assignment(actor, assignment_id) -> None:
    """Below 4 courses removal stays allowed (the student is already INCOMPLETE); at exactly 4 it is not."""
    assignment = CourseAssignment.objects.select_related("course").filter(pk=assignment_id).first()
    if assignment is None:
        raise AppError("NOT_FOUND", "Assignment not found.", 404)
    student = _lock_student(assignment.student_id)
    if student.assignments.count() == MIN_COURSES:
        raise AppError("VALIDATION", f"A student must keep at least {MIN_COURSES} courses.", 422)

    _drop_selections(student, [assignment.course_id])
    assignment.delete()
    audit.log_audit(actor, audit.UPDATE, student, {"assignments": {"removed": [assignment.course.code]}})
