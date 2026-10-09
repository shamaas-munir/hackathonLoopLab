"""Admin review of change requests: R11 (approve grants a one-time unlock), BN-3 (decision email)."""

from django.db import transaction

from apps.change_requests.models import ChangeRequest, RequestStatus, RequestType
from apps.students.models import Student
from common import audit
from common.emails import queue_email
from common.exceptions import AppError
from common.time import now

UNLOCK_FLAG = {RequestType.CHANGE_BRANCH: "branch_unlocked", RequestType.CHANGE_DATESHEET: "datesheet_unlocked"}
EMAIL_WORDING = {
    RequestType.CHANGE_BRANCH: ("change your exam branch", "Log in to select your new branch."),
    RequestType.CHANGE_DATESHEET: ("change your date sheet", "Log in to choose new slots and save your date sheet."),
}


def decide(request_id, admin, approve: bool, remark: str = "") -> ChangeRequest:
    """Approve or reject a pending request exactly once, even if two admins click at the same time."""
    status = RequestStatus.APPROVED if approve else RequestStatus.REJECTED
    with transaction.atomic():
        moment = now()
        updated = ChangeRequest.objects.filter(pk=request_id, status=RequestStatus.PENDING).update(
            status=status, admin_remark=remark, reviewed_by=admin, reviewed_at=moment, updated_at=moment
        )
        if not updated:
            raise AppError("CONFLICT", "This request has already been reviewed.", 409)

        request = ChangeRequest.objects.select_related("student__user").get(pk=request_id)
        student = request.student
        if approve:
            Student.objects.filter(pk=student.pk).update(**{UNLOCK_FLAG[request.type]: True})

        action, next_step = EMAIL_WORDING[request.type]
        queue_email(
            student.user.email,
            "request_decision",
            {
                "name": student.full_name,
                "request_type": action,
                "decision": status.label.lower(),
                "approved": approve,
                "next_step": next_step,
                "remark": remark,
            },
        )
        audit.log_audit(
            admin,
            audit.APPROVE if approve else audit.REJECT,
            request,
            {"student": student.registration_no, "type": request.type, "remark": remark},
        )
    return request
