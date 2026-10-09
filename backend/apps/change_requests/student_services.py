"""Need Help: a student raises a change request (R12, D8). Admin review lives in services.py (S4)."""

from apps.change_requests.models import ChangeRequest, RequestStatus, RequestType
from apps.students.models import Student
from common.exceptions import AppError


def my_requests(student: Student):
    return ChangeRequest.objects.filter(student=student).order_by("-created_at")


def raise_request(student: Student, type_: str, reason: str) -> ChangeRequest:
    student.refresh_from_db(fields=["branch", "datesheet_saved_at", "branch_unlocked", "datesheet_unlocked"])
    if type_ == RequestType.CHANGE_BRANCH:
        has_target, unlocked = student.branch_id is not None, student.branch_unlocked
        missing = "You have not selected a branch yet. Select one first."
    else:
        has_target, unlocked = student.datesheet_saved_at is not None, student.datesheet_unlocked
        missing = "You have not saved a date sheet yet. Save it first."

    if not has_target:
        raise AppError("VALIDATION", missing, 422, {"type": missing})
    if unlocked:
        raise AppError("CONFLICT", "Your previous request was approved. Make the change first.", 409)
    if ChangeRequest.objects.filter(student=student, type=type_, status=RequestStatus.PENDING).exists():
        raise AppError("CONFLICT", "You already have a pending request of this type.", 409)
    # A parallel duplicate still fails on the one_pending_request_per_type partial unique index (409).
    return ChangeRequest.objects.create(student=student, type=type_, reason=reason)
