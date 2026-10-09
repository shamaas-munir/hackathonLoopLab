"""Student self-service: profile and one-time branch selection (R5, R6, D7, D9)."""

from django.db import transaction
from django.db.models import F, Q

from apps.branches.models import Branch
from apps.scheduling.models import DatesheetSelection
from apps.scheduling.seats import release_seat, reserve_seat
from apps.students.models import Student
from common.exceptions import AppError
from common.models import Status
from common.time import now


def active_branches():
    return Branch.objects.filter(status=Status.ACTIVE).only(
        "id", "name", "code", "city", "address", "contact_number"
    )


def select_branch(student: Student, branch_id) -> None:
    branch = Branch.objects.filter(pk=branch_id, status=Status.ACTIVE).first()
    if branch is None:
        message = "This branch is not available. Choose an active branch."
        raise AppError("VALIDATION", message, 422, {"branch": message})

    with transaction.atomic():
        # One conditional UPDATE: allowed only when no branch is set yet or an approved unlock is active.
        updated = (
            Student.objects.filter(pk=student.pk)
            .filter(Q(branch__isnull=True) | Q(branch_unlocked=True))
            .update(branch=branch, branch_selected_at=now(), branch_unlocked=False, version=F("version") + 1)
        )
        if not updated:
            raise AppError("LOCKED", "Branch already selected. Raise a change request from Need Help.", 409)
        _move_selections(student, branch)


def _move_selections(student: Student, branch: Branch) -> None:
    """D7: a saved date sheet follows the student to the new branch if every slot has a seat there."""
    selections = (
        DatesheetSelection.objects.filter(student=student)
        .exclude(branch=branch)
        .select_related("slot__course", "branch")
        .order_by("slot_id")
    )
    for selection in selections:
        release_seat(selection.slot, selection.branch)
        try:
            reserve_seat(selection.slot, branch)
        except AppError:
            raise AppError(
                "SLOT_FULL",
                f"Your {selection.slot.course.code} exam slot is full at {branch.name}. "
                "Keep your current branch, or also request a date sheet change from Need Help.",
                409,
            ) from None
    selections.update(branch=branch)
