import re
from datetime import date

from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.students.models import CourseAssignment, Program, Student
from apps.students.state import MAX_COURSES, MIN_COURSES
from common.exceptions import AppError

CNIC_RE = re.compile(r"^\d{5}-\d{7}-\d$")
PHONE_RE = re.compile(r"^\+?\d[\d -]{6,17}\d$")
REG_NO_RE = re.compile(r"^[A-Z0-9][A-Z0-9-]{2,19}$")
SESSION_RE = re.compile(r"^(\d{4})-(\d{4})$")
CODE_RE = re.compile(r"^[A-Z0-9-]{2,12}$")
PHOTO_TYPES = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
MAX_PHOTO_BYTES = 2 * 1024 * 1024
MIN_AGE, MAX_AGE = 15, 80
MAX_MARKS = 1100

PHONE_FIELDS = ("phone", "guardian_contact", "emergency_contact")
CNIC_FIELDS = ("cnic", "guardian_cnic")


def account_status(user) -> str:
    """'invited' until the student sets a password through the emailed link."""
    return "invited" if user.password.startswith(UNUSABLE_PASSWORD_PREFIX) else "active"


def _age_on(born: date, today: date) -> int:
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


# --- Programs ---------------------------------------------------------------------------------


class ProgramSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Program
        fields = ["id", "name", "code", "duration_semesters", "student_count"]
        extra_kwargs = {"code": {"validators": []}}

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Name must be at least 3 characters.")
        return value

    def validate_code(self, value):
        value = value.strip().upper()
        if not CODE_RE.match(value):
            raise serializers.ValidationError("Use 2 to 12 letters, digits or hyphens.")
        others = Program.objects.exclude(pk=self.instance.pk) if self.instance else Program.objects.all()
        if others.filter(code=value).exists():
            message = "A program with this code already exists."
            raise AppError("CONFLICT", message, 409, {"code": message})
        return value

    def validate_duration_semesters(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Duration must be between 1 and 12 semesters.")
        return value


# --- Students ---------------------------------------------------------------------------------


class StudentListSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")
    program_name = serializers.CharField(source="program.name")
    branch_name = serializers.CharField(source="branch.name", default=None)
    assignment_count = serializers.IntegerField()
    account_status = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "full_name",
            "email",
            "photo",
            "registration_no",
            "program",
            "program_name",
            "semester",
            "branch",
            "branch_name",
            "assignment_count",
            "datesheet_saved_at",
            "datesheet_unlocked",
            "account_status",
            "created_at",
        ]

    @extend_schema_field(serializers.ChoiceField(choices=["invited", "active"]))
    def get_account_status(self, obj):
        return account_status(obj.user)


class StudentWriteSerializer(serializers.ModelSerializer):
    """Create / update payload. Flat fields; the form groups them as Personal, Guardian and Academic."""

    email = serializers.EmailField(max_length=254)
    photo = serializers.ImageField(required=False, allow_null=True)
    version = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        model = Student
        fields = [
            # Personal
            "full_name",
            "email",
            "phone",
            "cnic",
            "date_of_birth",
            "gender",
            "address",
            "photo",
            # Guardian
            "guardian_name",
            "guardian_cnic",
            "guardian_occupation",
            "guardian_contact",
            "emergency_contact",
            # Academic
            "registration_no",
            "program",
            "semester",
            "session",
            "previous_qualification",
            "previous_institute",
            "marks_or_cgpa",
            "version",
        ]
        # Uniqueness is checked in the service so it can answer 409 with every clashing field.
        validators = []
        extra_kwargs = {"cnic": {"validators": []}, "registration_no": {"validators": []}}

    def validate_full_name(self, value):
        value = " ".join(value.split())
        if not 3 <= len(value) <= 100:
            raise serializers.ValidationError("Full name must be 3 to 100 characters.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_date_of_birth(self, value):
        age = _age_on(value, timezone.localdate())
        if not MIN_AGE <= age <= MAX_AGE:
            raise serializers.ValidationError(f"Age must be between {MIN_AGE} and {MAX_AGE} years.")
        return value

    def validate_photo(self, value):
        if value is None:
            return value
        if value.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("Photo must be 2 MB or smaller.")
        image_format = getattr(getattr(value, "image", None), "format", None)
        if image_format not in PHOTO_TYPES:
            raise serializers.ValidationError("Photo must be a JPG, PNG or WEBP image.")
        return value

    def validate_registration_no(self, value):
        value = value.strip().upper()
        if not REG_NO_RE.match(value):
            raise serializers.ValidationError("Use letters, digits and hyphens, e.g. VU-2024-0001.")
        return value

    def validate_semester(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Semester must be between 1 and 12.")
        return value

    def validate_session(self, value):
        match = SESSION_RE.match(value.strip())
        if not match or int(match.group(2)) <= int(match.group(1)):
            raise serializers.ValidationError("Use the format 2024-2028.")
        return match.group(0)

    def validate_marks_or_cgpa(self, value):
        if not 0 <= value <= MAX_MARKS:
            raise serializers.ValidationError("Enter a CGPA from 0 to 4 or marks from 0 to 1100.")
        return value

    def validate(self, attrs):
        errors = {}
        for field in PHONE_FIELDS:
            if field in attrs and not PHONE_RE.match(attrs[field].strip()):
                errors[field] = "Enter a valid phone number, e.g. 0300-1234567."
        for field in CNIC_FIELDS:
            if field in attrs and not CNIC_RE.match(attrs[field].strip()):
                errors[field] = "Use the format 12345-1234567-1."
        if self.instance is not None and "version" not in attrs:
            errors["version"] = "Missing record version. Reload and try again."
        if errors:
            raise serializers.ValidationError(errors)
        for field in ("address", "guardian_name", "guardian_occupation", "previous_qualification"):
            if field in attrs:
                attrs[field] = attrs[field].strip()
        return attrs


class BranchBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    code = serializers.CharField()
    city = serializers.CharField()


class CourseBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    title = serializers.CharField()
    credit_hours = serializers.IntegerField()
    status = serializers.CharField()


class StudentAssignmentSerializer(serializers.ModelSerializer):
    course = CourseBriefSerializer()

    class Meta:
        model = CourseAssignment
        fields = ["id", "course", "created_at"]


class SelectionBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course_code = serializers.CharField(source="course.code")
    course_title = serializers.CharField(source="course.title")
    start_at = serializers.DateTimeField(source="slot.start_at")
    end_at = serializers.DateTimeField(source="slot.end_at", allow_null=True)
    branch_name = serializers.CharField(source="branch.name")


class RequestBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.CharField()
    status = serializers.CharField()
    reason = serializers.CharField()
    admin_remark = serializers.CharField()
    created_at = serializers.DateTimeField()
    reviewed_at = serializers.DateTimeField(allow_null=True)


class StudentDetailSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")
    account_status = serializers.SerializerMethodField()
    program_name = serializers.CharField(source="program.name")
    branch = BranchBriefSerializer(allow_null=True)
    assignments = StudentAssignmentSerializer(many=True)
    selections = SelectionBriefSerializer(many=True)
    requests = RequestBriefSerializer(many=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "version",
            "account_status",
            "created_at",
            # Personal
            "full_name",
            "email",
            "phone",
            "cnic",
            "date_of_birth",
            "gender",
            "address",
            "photo",
            # Guardian
            "guardian_name",
            "guardian_cnic",
            "guardian_occupation",
            "guardian_contact",
            "emergency_contact",
            # Academic
            "registration_no",
            "program",
            "program_name",
            "semester",
            "session",
            "previous_qualification",
            "previous_institute",
            "marks_or_cgpa",
            # Exam flow
            "branch",
            "branch_selected_at",
            "datesheet_saved_at",
            "branch_unlocked",
            "datesheet_unlocked",
            "assignments",
            "selections",
            "requests",
        ]

    @extend_schema_field(serializers.ChoiceField(choices=["invited", "active"]))
    def get_account_status(self, obj):
        return account_status(obj.user)


class StudentCreatedSerializer(StudentDetailSerializer):
    email_queued = serializers.BooleanField(default=True)

    class Meta(StudentDetailSerializer.Meta):
        fields = [*StudentDetailSerializer.Meta.fields, "email_queued"]


# --- Assignments ------------------------------------------------------------------------------


class ReplaceCoursesSerializer(serializers.Serializer):
    course_ids = serializers.ListField(child=serializers.UUIDField(), max_length=MAX_COURSES + 10)

    def validate_course_ids(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Each course can be assigned only once.")
        if not MIN_COURSES <= len(value) <= MAX_COURSES:
            raise serializers.ValidationError(f"Select between {MIN_COURSES} and {MAX_COURSES} courses.")
        return value


class AddCourseSerializer(serializers.Serializer):
    course_id = serializers.UUIDField()


class AssignmentListSerializer(serializers.ModelSerializer):
    student_id = serializers.UUIDField(source="student.id")
    student_name = serializers.CharField(source="student.full_name")
    registration_no = serializers.CharField(source="student.registration_no")
    program_name = serializers.CharField(source="student.program.name")
    course = CourseBriefSerializer()
    student_course_count = serializers.IntegerField()
    locked = serializers.SerializerMethodField()

    class Meta:
        model = CourseAssignment
        fields = [
            "id",
            "student_id",
            "student_name",
            "registration_no",
            "program_name",
            "course",
            "student_course_count",
            "locked",
            "created_at",
        ]

    def get_locked(self, obj) -> bool:
        student = obj.student
        return student.datesheet_saved_at is not None and not student.datesheet_unlocked


class StudentCoursesSerializer(serializers.Serializer):
    """Response of the assignment endpoints: the student's current course set."""

    assignment_count = serializers.IntegerField()
    assignments = StudentAssignmentSerializer(many=True)
