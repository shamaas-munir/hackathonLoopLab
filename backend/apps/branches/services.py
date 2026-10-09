from django.db import transaction
from django.db.models import Q

from apps.students.models import Student
from common import audit
from common.exceptions import AppError
from common.models import Status

from .models import Branch


def plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


@transaction.atomic
def delete_branch(actor, branch: Branch) -> None:
    """D1 / R16: a branch chosen by any student (now or in a saved date sheet) is never hard-deleted."""
    used_by = Student.objects.filter(Q(branch=branch) | Q(selections__branch=branch)).distinct().count()
    if used_by:
        raise AppError(
            "IN_USE", f"This branch is chosen by {plural(used_by, 'student')}. Mark it inactive instead.", 409
        )
    audit.log_audit(actor, audit.DELETE, str(branch), {"id": str(branch.pk)})
    branch.delete()


@transaction.atomic
def toggle_status(actor, branch: Branch) -> None:
    branch.status = Status.INACTIVE if branch.status == Status.ACTIVE else Status.ACTIVE
    branch.save(update_fields=["status", "updated_at"])
    audit.log_audit(actor, audit.UPDATE, branch, {"status": branch.status})
