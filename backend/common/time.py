"""Time helpers. All exam times are Asia/Karachi (D14)."""

from datetime import date, datetime, time, timedelta

from django.db.backends.postgresql.psycopg_any import DateTimeTZRange
from django.utils import timezone

DEFAULT_EXAM_DURATION = timedelta(hours=3)  # D5: slot without end time lasts 3 hours


def now() -> datetime:
    return timezone.now()


def combine(day: date, at: time) -> datetime:
    """Local date + time -> aware datetime in the project time zone."""
    return timezone.make_aware(datetime.combine(day, at))


def slot_end(start_at: datetime, end_at: datetime | None) -> datetime:
    return end_at or start_at + DEFAULT_EXAM_DURATION


def slot_range(start_at: datetime, end_at: datetime | None) -> DateTimeTZRange:
    """Half-open range [start, end) so back-to-back exams don't overlap."""
    return DateTimeTZRange(start_at, slot_end(start_at, end_at), "[)")


def overlaps(a_start: datetime, a_end: datetime | None, b_start: datetime, b_end: datetime | None) -> bool:
    return a_start < slot_end(b_start, b_end) and b_start < slot_end(a_start, a_end)


def is_past(moment: datetime) -> bool:
    return moment <= now()


def local(moment: datetime) -> datetime:
    return timezone.localtime(moment)
