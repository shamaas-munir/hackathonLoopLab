"""Admin review of change requests: R11 grant, double approval guard, BN-3 email, filters."""

import pytest
from django.core import mail

from apps.change_requests.models import ChangeRequest
from apps.core.models import AuditLog
from apps.notifications.models import EmailOutbox
from apps.scheduling.models import DatesheetSelection
from common.time import slot_range

pytestmark = pytest.mark.django_db
URL = "/api/v1/admin/requests/"


@pytest.fixture
def make_request(make_student, branch):
    def _make(type="change_datesheet", student=None, **kwargs):
        student = student or make_student(branch=branch)
        return ChangeRequest.objects.create(student=student, type=type, reason="I need a different time", **kwargs)

    return _make


@pytest.mark.parametrize(
    ("type", "flag"), [("change_datesheet", "datesheet_unlocked"), ("change_branch", "branch_unlocked")]
)
def test_approve_sets_unlock_flag_and_queues_email(
    admin_api, admin_user, make_request, django_capture_on_commit_callbacks, type, flag
):
    request = make_request(type=type)
    with django_capture_on_commit_callbacks(execute=True):
        response = admin_api.post(f"{URL}{request.pk}/approve/", {"remark": "Approved once"})

    assert response.status_code == 200, response.json()
    assert response.json()["status"] == "approved" and response.json()["reviewed_by"] == admin_user.email
    request.refresh_from_db()
    request.student.refresh_from_db()
    assert request.status == "approved" and request.admin_remark == "Approved once" and request.reviewed_at
    assert getattr(request.student, flag) is True

    outbox = EmailOutbox.objects.get(template="request_decision")
    assert outbox.to == request.student.user.email and outbox.status == "sent"
    assert "approved" in mail.outbox[0].body and "Approved once" in mail.outbox[0].body
    assert AuditLog.objects.filter(action="approve", entity_id=str(request.pk)).exists()


def test_double_approve_is_409(admin_api, make_request):
    request = make_request()
    assert admin_api.post(f"{URL}{request.pk}/approve/").status_code == 200
    second = admin_api.post(f"{URL}{request.pk}/reject/")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"
    assert EmailOutbox.objects.count() == 1


def test_reject_changes_only_status_and_remark(admin_api, make_request):
    request = make_request()
    response = admin_api.post(f"{URL}{request.pk}/reject/", {"remark": "Not possible now"})
    assert response.status_code == 200
    request.refresh_from_db()
    request.student.refresh_from_db()
    assert request.status == "rejected" and request.admin_remark == "Not possible now"
    assert request.student.datesheet_unlocked is False and request.student.branch_unlocked is False
    assert EmailOutbox.objects.filter(template="request_decision", context__decision="rejected").exists()


def test_remark_is_limited_to_500_chars(admin_api, make_request):
    request = make_request()
    response = admin_api.post(f"{URL}{request.pk}/approve/", {"remark": "x" * 501})
    assert response.status_code == 422
    request.refresh_from_db()
    assert request.status == "pending"


def test_unknown_request_is_404(admin_api):
    assert admin_api.post(f"{URL}00000000-0000-0000-0000-000000000000/approve/").status_code == 404


def test_filters_and_search_return_filtered_counts(admin_api, make_request, make_student, branch):
    make_request()
    make_request(type="change_branch", status="approved")
    target = make_student(branch=branch, full_name="Zainab Akhtar")
    make_request(type="change_branch", student=target)

    assert admin_api.get(URL).json()["count"] == 3
    assert admin_api.get(URL, {"status": "pending"}).json()["count"] == 2
    assert admin_api.get(URL, {"status": "pending", "type": "change_branch"}).json()["count"] == 1
    body = admin_api.get(URL, {"search": "zainab"}).json()
    assert body["count"] == 1
    row = body["results"][0]
    assert row["student"]["full_name"] == "Zainab Akhtar" and row["student"]["branch"] == branch.name


def test_retrieve_includes_current_datesheet(admin_api, make_request, make_course, make_slot, make_student, branch):
    course = make_course()
    slot = make_slot(course)
    student = make_student(courses=[course], branch=branch)
    DatesheetSelection.objects.create(
        student=student, course=course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
    )
    body = admin_api.get(f"{URL}{make_request(student=student).pk}/").json()
    assert body["student"]["branch"] == branch.name and body["branch_city"] == branch.city
    assert [row["course_code"] for row in body["datesheet"]] == [course.code]


def test_students_cannot_review(student_api, make_request):
    request = make_request()
    assert student_api(request.student).post(f"{URL}{request.pk}/approve/").status_code == 403
