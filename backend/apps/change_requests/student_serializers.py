from rest_framework import serializers

from apps.change_requests.models import ChangeRequest, RequestType


class MyRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeRequest
        fields = ["id", "type", "reason", "status", "admin_remark", "created_at", "reviewed_at"]
        read_only_fields = fields


class RaiseRequestSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=RequestType.choices)
    reason = serializers.CharField(
        min_length=10,
        max_length=500,
        error_messages={
            "min_length": "Please explain in at least 10 characters.",
            "max_length": "Keep the reason under 500 characters.",
        },
    )
