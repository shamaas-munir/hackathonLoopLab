from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.change_requests import admin_services
from apps.change_requests.admin_serializers import (
    AdminRequestDetailSerializer,
    AdminRequestSerializer,
    DecisionSerializer,
)
from apps.change_requests.models import ChangeRequest
from common.pagination import StandardPagination
from common.permissions import IsAdmin


class AdminRequestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    pagination_class = StandardPagination
    queryset = ChangeRequest.objects.select_related("student__user", "student__branch", "reviewed_by")
    filterset_fields = ["status", "type"]
    search_fields = ["student__full_name", "student__registration_no", "reason"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        return AdminRequestSerializer if self.action == "list" else AdminRequestDetailSerializer

    def _decide(self, request, approve):
        decision = DecisionSerializer(data=request.data)
        decision.is_valid(raise_exception=True)
        pk = self.get_object().pk  # 404 for unknown ids
        admin_services.decide(pk, request.user, approve, decision.validated_data["remark"])
        return Response(AdminRequestDetailSerializer(self.get_queryset().get(pk=pk)).data)

    @extend_schema(request=DecisionSerializer, responses=AdminRequestDetailSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, approve=True)

    @extend_schema(request=DecisionSerializer, responses=AdminRequestDetailSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, approve=False)
