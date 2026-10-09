import re

from rest_framework import serializers

from .models import Branch

CODE_RE = re.compile(r"^[A-Z0-9]{2,10}$")
# Mobile 03XXXXXXXXX (or 03XX-XXXXXXX), +923XXXXXXXXX, or a landline like 042-35761234.
CONTACT_RE = re.compile(r"^(03\d{2}-?\d{7}|\+923\d{9}|0\d{2,3}-\d{6,8})$")


def clean_text(value: str, label: str, min_len: int, max_len: int) -> str:
    """Collapse whitespace and check the length."""
    value = " ".join(value.split())
    if not min_len <= len(value) <= max_len:
        raise serializers.ValidationError(f"{label} must be {min_len} to {max_len} characters.")
    return value


def clean_code(value: str, pattern: re.Pattern, hint: str) -> str:
    value = value.strip().upper()
    if not pattern.match(value):
        raise serializers.ValidationError(hint)
    return value


class BranchSerializer(serializers.ModelSerializer):
    students_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Branch
        fields = [
            "id",
            "name",
            "code",
            "city",
            "address",
            "contact_number",
            "status",
            "students_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        # Uniqueness is left to the database constraint, so duplicates return 409 CONFLICT with a field error.
        extra_kwargs = {"code": {"validators": []}}

    def validate_name(self, value):
        return clean_text(value, "Name", 2, 100)

    def validate_code(self, value):
        return clean_code(value, CODE_RE, "Code must be 2 to 10 letters or digits, e.g. LHR.")

    def validate_city(self, value):
        return clean_text(value, "City", 2, 60)

    def validate_address(self, value):
        return clean_text(value, "Address", 5, 255)

    def validate_contact_number(self, value):
        value = value.strip()
        if not CONTACT_RE.match(value):
            raise serializers.ValidationError("Use 03XXXXXXXXX, +923XXXXXXXXX or a landline like 042-35761234.")
        return value
