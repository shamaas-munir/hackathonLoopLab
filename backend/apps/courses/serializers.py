import re

from rest_framework import serializers

from apps.branches.serializers import clean_code, clean_text

from .models import Course, Department

COURSE_CODE_RE = re.compile(r"^[A-Z]{2,6}[0-9]{2,4}[A-Z]?$")
DEPARTMENT_CODE_RE = re.compile(r"^[A-Z0-9]{2,10}$")


class DepartmentSerializer(serializers.ModelSerializer):
    courses_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Department
        fields = ["id", "name", "code", "courses_count"]
        read_only_fields = ["id"]
        extra_kwargs = {"code": {"validators": []}}  # duplicates -> DB constraint -> 409

    def validate_name(self, value):
        return clean_text(value, "Name", 2, 100)

    def validate_code(self, value):
        return clean_code(value, DEPARTMENT_CODE_RE, "Code must be 2 to 10 letters or digits, e.g. CS.")


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    slots_count = serializers.IntegerField(read_only=True, default=0)
    assignments_count = serializers.IntegerField(read_only=True, default=0)
    credit_hours = serializers.IntegerField(
        min_value=1,
        max_value=6,
        error_messages={
            "min_value": "Credit hours must be between 1 and 6.",
            "max_value": "Credit hours must be between 1 and 6.",
        },
    )

    class Meta:
        model = Course
        fields = [
            "id",
            "code",
            "title",
            "credit_hours",
            "department",
            "department_name",
            "status",
            "slots_count",
            "assignments_count",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {"code": {"validators": []}}  # duplicates -> DB constraint -> 409

    def validate_code(self, value):
        return clean_code(value, COURSE_CODE_RE, "Use a code like CS101: letters followed by digits.")

    def validate_title(self, value):
        return clean_text(value, "Title", 2, 150)
