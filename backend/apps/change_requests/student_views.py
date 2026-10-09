from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.change_requests import student_services
from apps.change_requests.student_serializers import MyRequestSerializer, RaiseRequestSerializer
from common.permissions import IsStudent


class MyRequestsView(APIView):
    """Own requests only, newest first. Not paginated: one pending per type keeps the list short."""

    permission_classes = [IsStudent]

    @extend_schema(responses=MyRequestSerializer(many=True))
    def get(self, request):
        requests = student_services.my_requests(request.user.student)
        return Response(MyRequestSerializer(requests, many=True).data)

    @extend_schema(request=RaiseRequestSerializer, responses={201: MyRequestSerializer})
    def post(self, request):
        data = RaiseRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        created = student_services.raise_request(
            request.user.student, data.validated_data["type"], data.validated_data["reason"]
        )
        return Response(MyRequestSerializer(created).data, status=status.HTTP_201_CREATED)
