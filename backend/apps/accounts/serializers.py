from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class FlowStateSerializer(serializers.Serializer):
    has_branch = serializers.BooleanField()
    needs_branch_selection = serializers.BooleanField()
    assignment_count = serializers.IntegerField()
    assignment_complete = serializers.BooleanField()
    has_saved_datesheet = serializers.BooleanField()
    can_edit_datesheet = serializers.BooleanField()
    branch_unlocked = serializers.BooleanField()
    datesheet_unlocked = serializers.BooleanField()
    home_route = serializers.CharField()


class MeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    role = serializers.CharField()
    name = serializers.CharField()
    flow = FlowStateSerializer(allow_null=True)


class LoginResponseSerializer(serializers.Serializer):
    role = serializers.CharField()
    redirect_to = serializers.CharField()
