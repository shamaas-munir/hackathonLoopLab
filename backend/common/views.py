from rest_framework import viewsets

from common import audit
from common.pagination import StandardPagination
from common.permissions import IsAdmin


class AdminModelViewSet(viewsets.ModelViewSet):
    """CRUD for admins with server-side pagination, search, filters, ordering and audit logging.

    Subclasses set `queryset`, `serializer_class`, `search_fields`, `filterset_fields` / `filterset_class`,
    `ordering_fields` and `ordering`.
    """

    permission_classes = [IsAdmin]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def perform_create(self, serializer):
        instance = serializer.save()
        audit.log_audit(self.request.user, audit.CREATE, instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        audit.log_audit(self.request.user, audit.UPDATE, instance, {"fields": sorted(serializer.validated_data)})

    def perform_destroy(self, instance):
        audit.log_audit(self.request.user, audit.DELETE, str(instance), {"id": str(instance.pk)})
        instance.delete()
