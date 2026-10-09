"""Response shape of the dashboard endpoint (used for the OpenAPI schema)."""

from rest_framework import serializers


class TotalsSerializer(serializers.Serializer):
    students = serializers.IntegerField()
    active_branches = serializers.IntegerField()
    active_courses = serializers.IntegerField()
    upcoming_slots = serializers.IntegerField()


class DatesheetsSerializer(serializers.Serializer):
    saved = serializers.IntegerField()
    not_saved = serializers.IntegerField()


class BranchCountSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    status = serializers.CharField()
    students_count = serializers.IntegerField()


class StatusCountSerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class DayCountSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class DashboardSerializer(serializers.Serializer):
    totals = TotalsSerializer()
    datesheets = DatesheetsSerializer()
    assignment_incomplete = serializers.IntegerField()
    pending_requests = serializers.IntegerField()
    students_per_branch = BranchCountSerializer(many=True)
    requests_by_status = StatusCountSerializer(many=True)
    saved_per_day = DayCountSerializer(many=True)
