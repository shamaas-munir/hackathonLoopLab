from django.db.models import Count, Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scheduling.models import DatesheetSelection
from apps.students import services
from apps.students.filters import AssignmentFilter, StudentFilter
from apps.students.models import CourseAssignment, Program, Student
from apps.students.serializers import (
    AddCourseSerializer,
    AssignmentListSerializer,
    ProgramSerializer,
    ReplaceCoursesSerializer,
    StudentCoursesSerializer,
    StudentCreatedSerializer,
    StudentDetailSerializer,
    StudentListSerializer,
    StudentWriteSerializer,
)
from common.exceptions import AppError
from common.pagination import StandardPagination
from common.permissions import IsAdmin
from common.views import AdminModelViewSet


class ProgramViewSet(AdminModelViewSet):
    queryset = Program.objects.annotate(student_count=Count("students"))
    serializer_class = ProgramSerializer
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "duration_semesters", "student_count"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        if instance.student_count:
            raise AppError("IN_USE", "This program has students, so it can't be deleted.", 409)
        super().perform_destroy(instance)


def _courses_payload(student) -> dict:
    assignments = list(student.assignments.select_related("course"))
    return StudentCoursesSerializer({"assignment_count": len(assignments), "assignments": assignments}).data


def _student_queryset():
    return Student.objects.select_related("user", "program", "branch")


def _detail_queryset():
    return _student_queryset().prefetch_related(
        Prefetch("assignments", CourseAssignment.objects.select_related("course")),
        Prefetch("selections", DatesheetSelection.objects.select_related("course", "slot", "branch")),
        "requests",
    )


class StudentViewSet(AdminModelViewSet):
    filterset_class = StudentFilter
    search_fields = ["full_name", "registration_no", "user__email", "cnic"]
    ordering_fields = ["full_name", "registration_no", "created_at", "semester", "assignment_count"]
    ordering = ["full_name"]

    def get_queryset(self):
        if self.action == "list":
            return _student_queryset().annotate(assignment_count=Count("assignments"))
        if self.action == "retrieve":
            return _detail_queryset()
        return _student_queryset()

    def get_serializer_class(self):
        if self.action == "list":
            return StudentListSerializer
        if self.action in ("create", "update", "partial_update"):
            return StudentWriteSerializer
        return StudentDetailSerializer

    def _detail(self, pk, serializer_class=StudentDetailSerializer):
        return serializer_class(_detail_queryset().get(pk=pk), context=self.get_serializer_context()).data

    @extend_schema(request=StudentWriteSerializer, responses={201: StudentCreatedSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = services.create_student(request.user, serializer.validated_data)
        return Response(self._detail(student.pk, StudentCreatedSerializer), status=status.HTTP_201_CREATED)

    @extend_schema(request=StudentWriteSerializer, responses=StudentDetailSerializer)
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        services.update_student(request.user, instance.pk, serializer.validated_data)
        return Response(self._detail(instance.pk))

    def perform_destroy(self, instance):
        services.delete_student(self.request.user, instance)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=["post"], url_path="resend-invite")
    def resend_invite(self, request, pk=None):
        services.resend_invite(request.user, self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(methods=["PUT"], request=ReplaceCoursesSerializer, responses=StudentCoursesSerializer)
    @extend_schema(methods=["POST"], request=AddCourseSerializer, responses=StudentCoursesSerializer)
    @action(detail=True, methods=["put", "post"], url_path="assignments")
    def assignments(self, request, pk=None):
        student = self.get_object()
        if request.method == "PUT":
            data = ReplaceCoursesSerializer(data=request.data)
            data.is_valid(raise_exception=True)
            services.replace_courses(request.user, student.pk, data.validated_data["course_ids"])
        else:
            data = AddCourseSerializer(data=request.data)
            data.is_valid(raise_exception=True)
            services.add_course(request.user, student.pk, data.validated_data["course_id"])
        return Response(_courses_payload(student))


class AssignmentViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdmin]
    pagination_class = StandardPagination
    serializer_class = AssignmentListSerializer
    filterset_class = AssignmentFilter
    search_fields = ["student__full_name", "student__registration_no", "course__code", "course__title"]
    ordering_fields = ["created_at", "student__full_name", "student__registration_no", "course__code"]
    ordering = ["student__full_name", "course__code"]
    queryset = CourseAssignment.objects.select_related("student__program", "course").annotate(
        student_course_count=Count("student__assignments")
    )

    def destroy(self, request, *args, **kwargs):
        services.remove_assignment(request.user, kwargs["pk"])
        return Response(status=status.HTTP_204_NO_CONTENT)
