import pytest
from django.utils import timezone

from apps.branches.models import Branch
from apps.change_requests.models import ChangeRequest

pytestmark = pytest.mark.django_db

URL = "/api/v1/admin/dashboard/"


def test_dashboard_numbers_match_data(admin_api, branch, make_student, make_course, make_slot):
    Branch.objects.create(name="Old Campus", code="OLD", city="Quetta", address="Somewhere", status="inactive")
    courses = [make_course() for _ in range(4)]
    make_course(status="inactive")
    make_slot(courses[0])
    make_slot(courses[1], days_ahead=-2)  # past slot is not "upcoming"

    saved = make_student(courses=courses, branch=branch, datesheet_saved_at=timezone.now())
    make_student(courses=courses[:3], branch=branch)
    make_student(courses=courses)
    ChangeRequest.objects.create(student=saved, type="change_datesheet", reason="Clash with a job interview")
    ChangeRequest.objects.create(student=saved, type="change_branch", reason="Moved city", status="rejected")

    data = admin_api.get(URL).json()
    assert data["totals"] == {"students": 3, "active_branches": 1, "active_courses": 4, "upcoming_slots": 1}
    assert data["datesheets"] == {"saved": 1, "not_saved": 2}
    assert data["assignment_incomplete"] == 1
    assert data["pending_requests"] == 1
    assert data["students_per_branch"][0] == {
        "code": "LHR",
        "name": "Lahore Campus",
        "status": "active",
        "students_count": 2,
    }
    assert {r["status"]: r["count"] for r in data["requests_by_status"]} == {"pending": 1, "approved": 0, "rejected": 1}
    assert len(data["saved_per_day"]) == 14
    assert data["saved_per_day"][-1] == {"date": timezone.localdate().isoformat(), "count": 1}


def test_dashboard_query_count_is_fixed(admin_api, make_student, django_assert_max_num_queries):
    for _ in range(5):
        make_student()
    with django_assert_max_num_queries(10):
        assert admin_api.get(URL).status_code == 200


def test_dashboard_is_admin_only(make_student, student_api):
    assert student_api(make_student()).get(URL).status_code == 403
