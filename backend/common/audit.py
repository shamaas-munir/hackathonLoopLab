"""Audit log of admin actions (bonus BN-5)."""

from django.db import models

CREATE, UPDATE, DELETE, APPROVE, REJECT = "create", "update", "delete", "approve", "reject"


def log_audit(actor, action: str, instance_or_label, details: dict | None = None):
    from apps.core.models import AuditLog

    if isinstance(instance_or_label, models.Model):
        entity = instance_or_label._meta.model_name
        entity_id = str(instance_or_label.pk)
        label = str(instance_or_label)[:200]
    else:
        entity, entity_id, label = str(instance_or_label), "", str(instance_or_label)[:200]

    AuditLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        label=label,
        details=details or {},
    )
