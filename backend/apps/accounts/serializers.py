import re

from rest_framework import serializers

from apps.accounts.tokens import RESET, SETUP

PURPOSES = [SETUP, RESET]


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


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class MessageSerializer(serializers.Serializer):
    message = serializers.CharField()


class TokenSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    purpose = serializers.ChoiceField(choices=PURPOSES)


class ValidateTokenResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    purpose = serializers.ChoiceField(choices=PURPOSES, required=False)
    name = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)


class SetPasswordSerializer(TokenSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_password(self, value):
        # Django's validators (length, common, numeric, similarity) run in the service, where the user is known.
        if not (re.search(r"[A-Za-z]", value) and re.search(r"\d", value)):
            raise serializers.ValidationError("Use at least one letter and one number.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs
