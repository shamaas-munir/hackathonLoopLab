from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Q

from common.models import Status, TimeStampedModel


class Department(TimeStampedModel):
    """Lookup table so department names aren't repeated as free text on every course (3NF)."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["code"], name="unique_department_code")]

    def __str__(self):
        return self.name


class Course(TimeStampedModel):
    code = models.CharField(max_length=12)
    title = models.CharField(max_length=150)
    credit_hours = models.PositiveSmallIntegerField()
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="courses")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(fields=["code"], name="unique_course_code"),
            models.CheckConstraint(
                condition=Q(credit_hours__gte=1) & Q(credit_hours__lte=6), name="course_credit_hours_1_6"
            ),
        ]
        indexes = [
            models.Index(fields=["status", "code"], name="course_status_code_idx"),
            GinIndex(fields=["title"], name="course_title_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["code"], name="course_code_trgm", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.title}"
