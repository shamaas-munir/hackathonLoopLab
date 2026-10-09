from django.db.models import Count

from common.views import AdminModelViewSet

from . import services
from .models import Course, Department
from .serializers import CourseSerializer, DepartmentSerializer


class DepartmentViewSet(AdminModelViewSet):
    queryset = Department.objects.annotate(courses_count=Count("courses"))
    serializer_class = DepartmentSerializer
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        services.delete_department(self.request.user, instance)


class CourseViewSet(AdminModelViewSet):
    queryset = Course.objects.select_related("department").annotate(
        slots_count=Count("slots", distinct=True),
        assignments_count=Count("assignments", distinct=True),
    )
    serializer_class = CourseSerializer
    search_fields = ["code", "title", "department__name"]
    filterset_fields = ["status", "department"]
    ordering_fields = ["code", "title", "credit_hours", "department__name"]
    ordering = ["code"]

    def perform_destroy(self, instance):
        services.delete_course(self.request.user, instance)
