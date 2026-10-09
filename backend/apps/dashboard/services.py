"""Read-only admin dashboard numbers. A fixed handful of aggregate queries, no per-row work."""

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.branches.models import Branch
from apps.change_requests.models import ChangeRequest, RequestStatus
from apps.courses.models import Course
from apps.scheduling.models import ExamSlot
from apps.students.models import Student
from common.models import Status
from common.time import now

MIN_COURSES = 4
SAVED_DAYS = 14


def _saved_per_day() -> list[dict]:
    today = timezone.localdate()
    first = today - timedelta(days=SAVED_DAYS - 1)
    rows = (
        Student.objects.filter(datesheet_saved_at__date__gte=first)
        .annotate(day=TruncDate("datesheet_saved_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    by_day = {row["day"]: row["count"] for row in rows}
    days = (first + timedelta(days=i) for i in range(SAVED_DAYS))
    return [{"date": day.isoformat(), "count": by_day.get(day, 0)} for day in days]


def dashboard_stats() -> dict:
    students = Student.objects.aggregate(
        total=Count("id"), saved=Count("id", filter=Q(datesheet_saved_at__isnull=False))
    )
    incomplete = Student.objects.annotate(n=Count("assignments")).filter(n__lt=MIN_COURSES).count()
    requests = dict(ChangeRequest.objects.values_list("status").annotate(count=Count("id")).order_by())
    per_branch = (
        Branch.objects.values("code", "name", "status")
        .annotate(students_count=Count("students"))
        .order_by("-students_count", "name")
    )

    return {
        "totals": {
            "students": students["total"],
            "active_branches": Branch.objects.filter(status=Status.ACTIVE).count(),
            "active_courses": Course.objects.filter(status=Status.ACTIVE).count(),
            "upcoming_slots": ExamSlot.objects.filter(start_at__gt=now()).count(),
        },
        "datesheets": {"saved": students["saved"], "not_saved": students["total"] - students["saved"]},
        "assignment_incomplete": incomplete,
        "pending_requests": requests.get(RequestStatus.PENDING, 0),
        "students_per_branch": list(per_branch),
        "requests_by_status": [
            {"status": value, "label": label, "count": requests.get(value, 0)} for value, label in RequestStatus.choices
        ],
        "saved_per_day": _saved_per_day(),
    }
