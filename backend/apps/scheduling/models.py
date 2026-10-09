from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeOperators
from django.db import models
from django.db.models import F, Q

from common.models import TimeStampedModel


class ExamSlot(TimeStampedModel):
    """A date + time the admin opens for a course. Valid at every branch (D4)."""

    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="slots")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(null=True, blank=True)  # optional; treated as start + 3 h (D5)
    capacity_per_branch = models.PositiveIntegerField(null=True, blank=True)  # null = unlimited (bonus BN-1)

    class Meta:
        ordering = ["start_at", "course__code"]
        constraints = [
            models.UniqueConstraint(fields=["course", "start_at"], name="unique_slot_per_course_start"),
            models.CheckConstraint(
                condition=Q(end_at__isnull=True) | Q(end_at__gt=F("start_at")), name="slot_end_after_start"
            ),
            models.CheckConstraint(
                condition=Q(capacity_per_branch__isnull=True) | Q(capacity_per_branch__gt=0),
                name="slot_capacity_positive",
            ),
        ]
        indexes = [models.Index(fields=["course", "start_at"], name="slot_course_start_idx")]

    def __str__(self):
        return f"{self.course_id} @ {self.start_at:%Y-%m-%d %H:%M}"


class SlotSeat(models.Model):
    """Seat counter per slot per branch. Denormalised on purpose: the 'is it full?' check becomes one
    conditional UPDATE, and the CHECK constraint makes overbooking impossible even under races."""

    slot = models.ForeignKey(ExamSlot, on_delete=models.CASCADE, related_name="seats")
    branch = models.ForeignKey("branches.Branch", on_delete=models.CASCADE, related_name="seats")
    capacity = models.PositiveIntegerField(null=True, blank=True)  # copied from the slot; null = unlimited
    booked = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["slot", "branch"], name="unique_seat_slot_branch"),
            models.CheckConstraint(
                condition=Q(capacity__isnull=True) | Q(booked__lte=F("capacity")), name="seat_booked_within_capacity"
            ),
        ]


class DatesheetSelection(models.Model):
    """One chosen slot per assigned course. `during` and `branch` are deliberate copies (see CLAUDE.md)."""

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="selections")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="selections")
    slot = models.ForeignKey(ExamSlot, on_delete=models.PROTECT, related_name="selections")
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="selections")
    during = DateTimeRangeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["during"]
        constraints = [
            models.UniqueConstraint(fields=["student", "course"], name="one_slot_per_course"),
            ExclusionConstraint(
                name="no_overlapping_exams",
                expressions=[("student", RangeOperators.EQUAL), ("during", RangeOperators.OVERLAPS)],
            ),
        ]
        indexes = [models.Index(fields=["slot", "branch"], name="selection_slot_branch_idx")]
