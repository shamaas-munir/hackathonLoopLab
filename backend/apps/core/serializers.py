from rest_framework import serializers

from apps.core.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.EmailField(source="actor.email", default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "created_at", "actor", "action", "entity", "entity_id", "label", "details"]
