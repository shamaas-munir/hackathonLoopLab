import uuid

from django.db import models


class OutboxStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


class EmailOutbox(models.Model):
    """Emails written in the same transaction as the business change, sent after commit."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    to = models.EmailField()
    template = models.CharField(max_length=50)
    context = models.JSONField(default=dict)
    status = models.CharField(max_length=10, choices=OutboxStatus.choices, default=OutboxStatus.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"], name="outbox_pending_idx", condition=models.Q(status="pending")),
        ]

    def __str__(self):
        return f"{self.template} → {self.to} ({self.status})"
