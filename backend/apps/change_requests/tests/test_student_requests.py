"""Need Help requests from the student side (R12, D8, R13)."""

import pytest
from django.utils import timezone

from apps.change_requests.models import ChangeRequest

pytestmark = pytest.mark.django_db
URL = "/api/v1/me/requests/"
REASON = "I moved to another city for a job."


@pytest.fixture
def saved_student(make_student, branch):
    return make_student(branch=branch, datesheet_saved_at=timezone.now())


def test_raise_and_list_own_requests(student_api, saved_student, make_student, branch):
    client = student_api(saved_student)
    response = client.post(URL, {"type": "change_branch", "reason": REASON})
    assert response.status_code == 201 and response.json()["status"] == "pending"

    other = make_student(branch=branch)
    ChangeRequest.objects.create(student=other, type="change_branch", reason="Someone else's reason")
    listed = client.get(URL).json()
    assert [r["reason"] for r in listed] == [REASON]


def test_duplicate_pending_rejected(student_api, saved_student):
    client = student_api(saved_student)
    assert client.post(URL, {"type": "change_datesheet", "reason": REASON}).status_code == 201
    second = client.post(URL, {"type": "change_datesheet", "reason": REASON})
    assert second.status_code == 409
    # The other type is still allowed.
    assert client.post(URL, {"type": "change_branch", "reason": REASON}).status_code == 201


def test_new_request_allowed_after_rejection(student_api, saved_student):
    client = student_api(saved_student)
    client.post(URL, {"type": "change_branch", "reason": REASON})
    ChangeRequest.objects.update(status="rejected", admin_remark="Not possible")
    assert client.post(URL, {"type": "change_branch", "reason": REASON}).status_code == 201


def test_d8_needs_something_to_change(student_api, make_student, branch):
    no_branch = student_api(make_student())
    assert no_branch.post(URL, {"type": "change_branch", "reason": REASON}).status_code == 422
    not_saved = student_api(make_student(branch=branch))
    assert not_saved.post(URL, {"type": "change_datesheet", "reason": REASON}).status_code == 422


def test_active_unlock_blocks_new_request(student_api, make_student, branch):
    student = make_student(branch=branch, datesheet_saved_at=timezone.now(), datesheet_unlocked=True)
    response = student_api(student).post(URL, {"type": "change_datesheet", "reason": REASON})
    assert response.status_code == 409
    assert "approved" in response.json()["error"]["message"]


@pytest.mark.parametrize("reason", ["too short", "x" * 501])
def test_reason_length_validated(student_api, saved_student, reason):
    response = student_api(saved_student).post(URL, {"type": "change_branch", "reason": reason})
    assert response.status_code == 422
    assert "reason" in response.json()["error"]["field_errors"]
