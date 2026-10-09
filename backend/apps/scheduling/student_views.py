from django.core.cache import cache
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.scheduling import datesheet_service
from apps.scheduling.student_serializers import CourseSlotsSerializer, DatesheetSerializer, SaveDatesheetSerializer
from common.exceptions import AppError
from common.permissions import IsStudent

IDEMPOTENCY_TTL = 10 * 60  # seconds; long enough to absorb double clicks and client retries


class MyCoursesView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(responses=CourseSlotsSerializer(many=True))
    def get(self, request):
        courses = datesheet_service.courses_with_slots(request.user.student)
        return Response(CourseSlotsSerializer(courses, many=True).data)


class MyDatesheetView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(responses=DatesheetSerializer)
    def get(self, request):
        return Response(DatesheetSerializer(datesheet_service.datesheet(request.user.student)).data)

    @extend_schema(
        request=SaveDatesheetSerializer,
        responses={201: DatesheetSerializer},
        parameters=[OpenApiParameter("Idempotency-Key", str, OpenApiParameter.HEADER, required=False)],
    )
    def post(self, request):
        student = request.user.student
        key = request.headers.get("Idempotency-Key", "")[:64]
        cache_key = f"idem:datesheet:{student.pk}:{key}" if key else None
        if cache_key and (replay := cache.get(cache_key)) is not None:
            return Response(replay, status=status.HTTP_201_CREATED)

        data = SaveDatesheetSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            datesheet_service.save_datesheet(student, data.validated_data["selections"])
        except AppError as exc:
            # A duplicate submit that raced the first one: it lost the row lock and now sees LOCKED.
            if exc.code == "LOCKED" and cache_key and (replay := cache.get(cache_key)) is not None:
                return Response(replay, status=status.HTTP_201_CREATED)
            raise

        body = DatesheetSerializer(datesheet_service.datesheet(student)).data
        if cache_key:
            cache.set(cache_key, body, IDEMPOTENCY_TTL)
        return Response(body, status=status.HTTP_201_CREATED)
