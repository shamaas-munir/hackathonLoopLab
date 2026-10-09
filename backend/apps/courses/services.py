from django.db import transaction

from apps.branches.services import plural
from common import audit
from common.exceptions import AppError

from .models import Course, Department


def _delete(actor, instance) -> None:
    audit.log_audit(actor, audit.DELETE, str(instance), {"id": str(instance.pk)})
    instance.delete()


@transaction.atomic
def delete_course(actor, course: Course) -> None:
    """D10: a course that is assigned to students or has exam slots can't be deleted."""
    reasons = []
    if assigned := course.assignments.count():
        reasons.append(f"is assigned to {plural(assigned, 'student')}")
    if slots := course.slots.count():
        reasons.append(f"has {plural(slots, 'exam slot')}")
    if reasons:
        raise AppError("IN_USE", f"This course {' and '.join(reasons)}. Mark it inactive instead.", 409)
    _delete(actor, course)


@transaction.atomic
def delete_department(actor, department: Department) -> None:
    if used := department.courses.count():
        message = f"This department is used by {plural(used, 'course')}. Move them to another department first."
        raise AppError("IN_USE", message, 409)
    _delete(actor, department)
