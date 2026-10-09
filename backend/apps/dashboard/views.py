from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdmin

from .serializers import DashboardSerializer
from .services import dashboard_stats


class DashboardView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(responses=DashboardSerializer)
    def get(self, request):
        return Response(dashboard_stats())
