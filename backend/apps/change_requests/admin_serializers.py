from rest_framework import serializers

from apps.change_requests.models import ChangeRequest
from apps.scheduling.models import DatesheetSelection
from apps.students.models import Student


class RequestStudentSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")
    branch = serializers.CharField(source="branch.name", default=None)

    class Meta:
        model = Student
        fields = ["id", "full_name", "registration_no", "email", "branch"]


class AdminRequestSerializer(serializers.ModelSerializer):
    student = RequestStudentSerializer()
    type_label = serializers.CharField(source="get_type_display")
    reviewed_by = serializers.EmailField(source="reviewed_by.email", default=None)

    class Meta:
        model = ChangeRequest
        fields = [
            "id",
            "student",
            "type",
            "type_label",
            "reason",
            "status",
            "admin_remark",
            "reviewed_by",
            "reviewed_at",
            "created_at",
        ]


class DatesheetEntrySerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code")
    course_title = serializers.CharField(source="course.title")
    start_at = serializers.DateTimeField(source="slot.start_at")
    end_at = serializers.DateTimeField(source="slot.end_at")

    class Meta:
        model = DatesheetSelection
        fields = ["id", "course_code", "course_title", "start_at", "end_at"]


class AdminRequestDetailSerializer(AdminRequestSerializer):
    """Adds what the reviewer needs to decide: the student's current branch and saved date sheet."""

    branch_city = serializers.CharField(source="student.branch.city", default=None)
    datesheet_saved_at = serializers.DateTimeField(source="student.datesheet_saved_at")
    datesheet = serializers.SerializerMethodField()

    class Meta(AdminRequestSerializer.Meta):
        fields = [*AdminRequestSerializer.Meta.fields, "branch_city", "datesheet_saved_at", "datesheet"]

    def get_datesheet(self, request) -> list[dict]:
        selections = (
            DatesheetSelection.objects.filter(student=request.student_id)
            .select_related("course", "slot")
            .order_by("slot__start_at")
        )
        return DatesheetEntrySerializer(selections, many=True).data


class DecisionSerializer(serializers.Serializer):
    remark = serializers.CharField(max_length=500, required=False, allow_blank=True, default="", trim_whitespace=True)
