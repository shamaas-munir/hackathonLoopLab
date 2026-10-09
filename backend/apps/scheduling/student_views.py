from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.scheduling import datesheet_service
from apps.scheduling.student_serializers import CourseSlotsSerializer, DatesheetSerializer, SaveDatesheetSerializer
from common.permissions import IsStudent


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

    @extend_schema(request=SaveDatesheetSerializer, responses={201: DatesheetSerializer})
    def post(self, request):
        data = SaveDatesheetSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        student = request.user.student
        datesheet_service.save_datesheet(student, data.validated_data["selections"])
        body = DatesheetSerializer(datesheet_service.datesheet(student)).data
        return Response(body, status=status.HTTP_201_CREATED)
