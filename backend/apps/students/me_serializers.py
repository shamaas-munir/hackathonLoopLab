from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers import FlowStateSerializer
from apps.branches.models import Branch
from apps.students.models import Student
from apps.students.state import flow_state


class MyBranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "code", "city", "address", "contact_number"]


class SelectBranchSerializer(serializers.Serializer):
    branch = serializers.UUIDField()


class PersonalSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")

    class Meta:
        model = Student
        fields = ["full_name", "email", "phone", "cnic", "date_of_birth", "gender", "address", "photo"]


class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ["guardian_name", "guardian_cnic", "guardian_occupation", "guardian_contact", "emergency_contact"]


class AcademicSerializer(serializers.ModelSerializer):
    program = serializers.CharField(source="program.name")

    class Meta:
        model = Student
        fields = [
            "registration_no",
            "program",
            "semester",
            "session",
            "previous_qualification",
            "previous_institute",
            "marks_or_cgpa",
        ]


class ProfileSerializer(serializers.ModelSerializer):
    personal = PersonalSerializer(source="*")
    guardian = GuardianSerializer(source="*")
    academic = AcademicSerializer(source="*")
    branch = MyBranchSerializer(allow_null=True)
    flow = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ["personal", "guardian", "academic", "branch", "flow"]

    @extend_schema_field(FlowStateSerializer)
    def get_flow(self, student):
        return flow_state(student)
