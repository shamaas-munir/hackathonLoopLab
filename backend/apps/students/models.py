from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Q

from common.models import TimeStampedModel


class Gender(models.TextChoices):
    MALE = "male", "Male"
    FEMALE = "female", "Female"
    OTHER = "other", "Other"


class Program(TimeStampedModel):
    """Degree program lookup (e.g. BS Computer Science) — avoids repeating program text per student."""

    name = models.CharField(max_length=120)
    code = models.CharField(max_length=12)
    duration_semesters = models.PositiveSmallIntegerField(default=8)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["code"], name="unique_program_code")]

    def __str__(self):
        return self.name


class Student(TimeStampedModel):
    """Student profile. Strictly 1–1 with a login User; guardian + academic details are 1–1 too."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student")

    # Personal
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    cnic = models.CharField(max_length=15, help_text="CNIC or B-Form: 12345-1234567-1")
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=Gender.choices)
    address = models.CharField(max_length=255)
    photo = models.ImageField(upload_to="students/photos/", blank=True)

    # Parent / guardian
    guardian_name = models.CharField(max_length=100)
    guardian_cnic = models.CharField(max_length=15)
    guardian_occupation = models.CharField(max_length=100)
    guardian_contact = models.CharField(max_length=20)
    emergency_contact = models.CharField(max_length=20)

    # Academic
    registration_no = models.CharField(max_length=20)
    program = models.ForeignKey(Program, on_delete=models.PROTECT, related_name="students")
    semester = models.PositiveSmallIntegerField()
    session = models.CharField(max_length=20, help_text="e.g. 2024-2028")
    previous_qualification = models.CharField(max_length=100)
    previous_institute = models.CharField(max_length=150)
    marks_or_cgpa = models.DecimalField(max_digits=6, decimal_places=2)

    # Exam flow state
    branch = models.ForeignKey(
        "branches.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="students"
    )
    branch_selected_at = models.DateTimeField(null=True, blank=True)
    datesheet_saved_at = models.DateTimeField(null=True, blank=True)
    branch_unlocked = models.BooleanField(default=False)  # one-time unlock after an approved request
    datesheet_unlocked = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)  # optimistic locking for admin edits

    class Meta:
        ordering = ["full_name"]
        constraints = [
            models.UniqueConstraint(fields=["cnic"], name="unique_student_cnic"),
            models.UniqueConstraint(fields=["registration_no"], name="unique_student_registration_no"),
            models.CheckConstraint(condition=Q(semester__gte=1) & Q(semester__lte=12), name="student_semester_1_12"),
            models.CheckConstraint(condition=Q(marks_or_cgpa__gte=0), name="student_marks_non_negative"),
        ]
        indexes = [
            models.Index(fields=["program", "semester"], name="student_program_sem_idx"),
            models.Index(fields=["branch", "datesheet_saved_at"], name="student_branch_saved_idx"),
            models.Index(
                fields=["created_at"], name="student_not_saved_idx", condition=Q(datesheet_saved_at__isnull=True)
            ),
            GinIndex(fields=["full_name"], name="student_name_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["registration_no"], name="student_regno_trgm", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.registration_no})"


class CourseAssignment(models.Model):
    """Courses assigned to a student by the admin (4–6 per student, enforced in the service layer)."""

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="assignments")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["course__code"]
        constraints = [models.UniqueConstraint(fields=["student", "course"], name="unique_assignment")]

    def __str__(self):
        return f"{self.student_id} → {self.course_id}"
