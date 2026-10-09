from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.students import me_services
from apps.students.me_serializers import MyBranchSerializer, ProfileSerializer, SelectBranchSerializer
from apps.students.models import Student
from common.permissions import IsStudent


class ProfileView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(responses=ProfileSerializer)
    def get(self, request):
        student = Student.objects.select_related("user", "program", "branch").get(pk=request.user.student.pk)
        return Response(ProfileSerializer(student, context={"request": request}).data)


class BranchListView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(responses=MyBranchSerializer(many=True))
    def get(self, request):
        return Response(MyBranchSerializer(me_services.active_branches(), many=True).data)


class SelectBranchView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(request=SelectBranchSerializer, responses=MyBranchSerializer)
    def post(self, request):
        data = SelectBranchSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        student = request.user.student
        me_services.select_branch(student, data.validated_data["branch"])
        student.refresh_from_db(fields=["branch"])
        return Response(MyBranchSerializer(student.branch).data)
