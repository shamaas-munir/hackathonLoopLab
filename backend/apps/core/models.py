from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Who did what in the admin panel (bonus BN-5)."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    action = models.CharField(max_length=10)
    entity = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=40, blank=True)
    label = models.CharField(max_length=200, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "-created_at"], name="audit_entity_idx")]

    def __str__(self):
        return f"{self.action} {self.entity} {self.label}"
