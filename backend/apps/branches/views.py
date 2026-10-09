from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from common.views import AdminModelViewSet

from . import services
from .models import Branch
from .serializers import BranchSerializer


class BranchViewSet(AdminModelViewSet):
    queryset = Branch.objects.annotate(students_count=Count("students"))
    serializer_class = BranchSerializer
    search_fields = ["name", "code", "city"]
    filterset_fields = ["status"]
    ordering_fields = ["name", "code", "city", "created_at", "students_count"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        services.delete_branch(self.request.user, instance)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        services.toggle_status(request.user, self.get_object())
        return Response(self.get_serializer(self.get_object()).data)
