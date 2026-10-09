from rest_framework import serializers

from apps.courses.models import Course
from apps.students.me_serializers import MyBranchSerializer


class MyCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "code", "title", "credit_hours"]


class SlotOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    day = serializers.CharField()
    seats_left = serializers.IntegerField(allow_null=True, help_text="null means unlimited")


class CourseSlotsSerializer(serializers.Serializer):
    course = MyCourseSerializer()
    slots = SlotOptionSerializer(many=True)
    selected_slot = serializers.UUIDField(allow_null=True)


class SelectionInputSerializer(serializers.Serializer):
    course = serializers.UUIDField()
    slot = serializers.UUIDField()


class SaveDatesheetSerializer(serializers.Serializer):
    selections = SelectionInputSerializer(many=True, allow_empty=False, max_length=10)


class DatesheetRowSerializer(serializers.Serializer):
    course_code = serializers.CharField()
    course_title = serializers.CharField()
    credit_hours = serializers.IntegerField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    day = serializers.CharField()


class DatesheetSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    registration_no = serializers.CharField()
    program = serializers.CharField()
    semester = serializers.IntegerField()
    session = serializers.CharField()
    branch = MyBranchSerializer()
    saved_at = serializers.DateTimeField()
    locked = serializers.BooleanField()
    rows = DatesheetRowSerializer(many=True)
