"""Admin exam slots: R17 (chosen slots protected, D2) and R18 (validation)."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.core.models import AuditLog
from apps.scheduling.models import DatesheetSelection, ExamSlot, SlotSeat
from common.time import slot_range

pytestmark = pytest.mark.django_db
URL = "/api/v1/admin/slots/"


def _future(days=7):
    return (timezone.localdate() + timedelta(days=days)).isoformat()


def _payload(course, **overrides):
    return {"course": str(course.pk), "date": _future(), "start_time": "09:00", "end_time": "12:00", **overrides}


def _choose(slot, student, branch):
    DatesheetSelection.objects.create(
        student=student, course=slot.course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
    )


def test_create_returns_local_date_day_and_times(admin_api, make_course):
    course = make_course()
    response = admin_api.post(URL, _payload(course, capacity_per_branch=30))
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["date"] == _future() and body["start_time"] == "09:00" and body["end_time"] == "12:00"
    assert body["day"] and body["course_code"] == course.code and body["chosen_count"] == 0
    slot = ExamSlot.objects.get()
    assert timezone.localtime(slot.start_at).hour == 9
    assert AuditLog.objects.filter(action="create", entity="examslot").exists()


def test_end_time_is_optional(admin_api, make_course):
    response = admin_api.post(URL, _payload(make_course(), end_time=None))
    assert response.status_code == 201
    assert response.json()["end_time"] is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"date": (timezone.localdate() - timedelta(days=1)).isoformat()}, "date"),
        ({"end_time": "09:00"}, "end_time"),
        ({"end_time": "08:00"}, "end_time"),
        ({"capacity_per_branch": 0}, "capacity_per_branch"),
    ],
)
def test_invalid_slot_is_422(admin_api, make_course, overrides, field):
    response = admin_api.post(URL, _payload(make_course(), **overrides))
    assert response.status_code == 422
    assert field in response.json()["error"]["field_errors"]


def test_inactive_course_is_422(admin_api, make_course):
    response = admin_api.post(URL, _payload(make_course(status="inactive")))
    assert response.status_code == 422
    assert "course" in response.json()["error"]["field_errors"]


def test_duplicate_slot_is_409(admin_api, make_course):
    course = make_course()
    assert admin_api.post(URL, _payload(course)).status_code == 201
    response = admin_api.post(URL, _payload(course, end_time="13:00"))
    assert response.status_code == 409
    assert response.json()["error"]["field_errors"]["start_time"].startswith("This course already has a slot")


def test_chosen_slot_cannot_be_edited_or_deleted(admin_api, make_course, make_slot, make_student, branch):
    slot = make_slot(make_course())
    _choose(slot, make_student(branch=branch), branch)

    edit = admin_api.patch(f"{URL}{slot.pk}/", {"capacity_per_branch": 5})
    delete = admin_api.delete(f"{URL}{slot.pk}/")
    for response in (edit, delete):
        assert response.status_code == 409
        assert response.json()["error"] == {
            "code": "IN_USE",
            "message": "1 student has chosen this slot. It can't be changed.",
            "field_errors": {},
        }
    assert ExamSlot.objects.filter(pk=slot.pk, capacity_per_branch=None).exists()


def test_free_slot_can_be_edited_and_deleted(admin_api, make_course, make_slot, branch):
    slot = make_slot(make_course())
    SlotSeat.objects.create(slot=slot, branch=branch, capacity=None)

    response = admin_api.patch(f"{URL}{slot.pk}/", {"start_time": "14:00", "end_time": None, "capacity_per_branch": 4})
    assert response.status_code == 200, response.json()
    assert response.json()["start_time"] == "14:00" and response.json()["end_time"] is None
    assert SlotSeat.objects.get(slot=slot).capacity == 4

    assert admin_api.delete(f"{URL}{slot.pk}/").status_code == 204
    assert not ExamSlot.objects.filter(pk=slot.pk).exists()
    assert AuditLog.objects.filter(action="delete", entity="examslot").exists()


def test_list_filters_search_and_counts(admin_api, make_course, make_slot, make_student, branch):
    cs, math = make_course(code="CS101", title="Programming"), make_course(code="MTH101", title="Calculus")
    chosen = make_slot(cs, days_ahead=3, capacity=10)
    make_slot(cs, days_ahead=20)
    make_slot(math, days_ahead=5)
    _choose(chosen, make_student(branch=branch), branch)

    body = admin_api.get(URL, {"search": "cs1"}).json()
    assert body["count"] == 2
    first = body["results"][0]
    assert first["chosen_count"] == 1 and first["total_capacity"] == 10  # one active branch

    assert admin_api.get(URL, {"course": str(math.pk)}).json()["count"] == 1
    window = {"date_from": _future(2), "date_to": _future(6)}
    assert admin_api.get(URL, window).json()["count"] == 2
    assert admin_api.get(URL, {"upcoming": "true", "page_size": 5}).json()["count"] == 3


def test_students_cannot_manage_slots(student_api, make_student):
    assert student_api(make_student()).get(URL).status_code == 403
