from rest_framework import serializers

from apps.courses.models import Course
from apps.scheduling import slot_services
from apps.scheduling.models import ExamSlot
from common.time import local


class AdminSlotSerializer(serializers.ModelSerializer):
    """Accepts local `date` + `start_time` (+ optional `end_time`); returns them back with `day` and seat info.

    List querysets annotate `chosen_count`; the view passes `active_branches` in the context.
    """

    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    date = serializers.DateField(write_only=True)
    start_time = serializers.TimeField(write_only=True)
    end_time = serializers.TimeField(write_only=True, required=False, allow_null=True)
    capacity_per_branch = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    class Meta:
        model = ExamSlot
        fields = [
            "id",
            "course",
            "course_code",
            "course_title",
            "date",
            "start_time",
            "end_time",
            "start_at",
            "end_at",
            "capacity_per_branch",
        ]
        read_only_fields = ["start_at", "end_at"]

    def validate(self, attrs):
        slot = self.instance
        if slot:
            slot_services.ensure_not_chosen(slot)
        start = local(slot.start_at) if slot else None
        course = attrs.get("course", slot.course if slot else None)
        day = attrs.get("date", start.date() if start else None)
        start_time = attrs.get("start_time", start.time() if start else None)
        if "end_time" in attrs:
            end_time = attrs["end_time"]
        else:
            end_time = local(slot.end_at).time() if slot and slot.end_at else None

        fields = slot_services.validate_slot(course, day, start_time, end_time, instance=slot)
        if "capacity_per_branch" in attrs or not slot:
            fields["capacity_per_branch"] = attrs.get("capacity_per_branch")
        return fields

    def update(self, instance, validated_data):
        return slot_services.update_slot(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        start = local(instance.start_at)
        chosen = getattr(instance, "chosen_count", None)
        if chosen is None:
            chosen = instance.selections.count()
        capacity = instance.capacity_per_branch
        branches = self.context.get("active_branches", 0)
        data.update(
            date=start.date().isoformat(),
            day=start.strftime("%A"),
            start_time=start.strftime("%H:%M"),
            end_time=local(instance.end_at).strftime("%H:%M") if instance.end_at else None,
            chosen_count=chosen,
            total_capacity=capacity * branches if capacity else None,
        )
        return data
