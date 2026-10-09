import django_filters
from rest_framework import mixins, viewsets

from apps.core.models import AuditLog
from apps.core.serializers import AuditLogSerializer
from common.pagination import StandardPagination
from common.permissions import IsAdmin


class AuditLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = AuditLog
        fields = ["action", "entity"]


class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only history of admin actions, newest first (bonus BN-5)."""

    permission_classes = [IsAdmin]
    pagination_class = StandardPagination
    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditLogSerializer
    filterset_class = AuditLogFilter
    search_fields = ["label", "details", "actor__email"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
