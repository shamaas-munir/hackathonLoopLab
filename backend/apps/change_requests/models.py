from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import TimeStampedModel


class RequestType(models.TextChoices):
    CHANGE_BRANCH = "change_branch", "Change branch"
    CHANGE_DATESHEET = "change_datesheet", "Change date sheet"


class RequestStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class ChangeRequest(TimeStampedModel):
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="requests")
    type = models.CharField(max_length=20, choices=RequestType.choices)
    reason = models.TextField(max_length=500)
    status = models.CharField(max_length=10, choices=RequestStatus.choices, default=RequestStatus.PENDING)
    admin_remark = models.TextField(max_length=500, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_requests"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "type"], condition=Q(status="pending"), name="one_pending_request_per_type"
            ),
        ]
        indexes = [
            models.Index(fields=["status", "type", "-created_at"], name="request_status_type_idx"),
            models.Index(fields=["student", "-created_at"], name="request_student_idx"),
        ]

    def __str__(self):
        return f"{self.get_type_display()} ({self.status})"
