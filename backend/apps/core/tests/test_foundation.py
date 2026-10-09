"""Foundation guarantees that every feature builds on: auth cookies, flow state, DB-level rules."""

import pytest
from django.db import IntegrityError, transaction

from apps.accounts.tokens import RESET, SETUP, bump_nonce, make_password_link, resolve_token
from apps.change_requests.models import ChangeRequest
from apps.scheduling.models import DatesheetSelection
from apps.scheduling.seats import reserve_seat, seats_left
from apps.students.state import flow_state
from common.exceptions import AppError
from common.time import slot_range
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


def _link_parts(link):
    uid, token = link.split("/set-password/")[1].split("?")[0].split("/")
    return uid, token


def test_login_sets_cookies_and_me_returns_flow(api, make_student, make_course, branch):
    student = make_student(courses=[make_course() for _ in range(4)], branch=branch)
    response = api.post("/api/v1/auth/login/", {"email": student.user.email, "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["redirect_to"] == "/student/dashboard"
    assert {"access", "refresh", "role"} <= set(response.cookies)

    me = api.get("/api/v1/auth/me/").json()
    assert me["role"] == "student" and me["flow"]["can_edit_datesheet"] is True


def test_wrong_password_is_generic_401(api, admin_user):
    response = api.post("/api/v1/auth/login/", {"email": admin_user.email, "password": "nope"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_flow_state_routes(make_student, make_course, branch):
    courses = [make_course() for _ in range(4)]
    assert flow_state(make_student(courses=courses))["home_route"] == "/student/select-branch"
    incomplete = flow_state(make_student(courses=courses[:3], branch=branch))
    assert incomplete["assignment_complete"] is False and incomplete["can_edit_datesheet"] is False


def test_password_links_are_single_use_and_revocable(admin_user):
    uid, token = _link_parts(make_password_link(admin_user, SETUP))
    assert resolve_token(uid, token, SETUP) == admin_user
    assert resolve_token(uid, token, RESET) is None  # links are purpose-bound

    bump_nonce(admin_user)  # a newer link was issued
    assert resolve_token(uid, token, SETUP) is None


def test_overlapping_exams_rejected_by_database(make_student, make_course, make_slot, branch):
    a, b = make_course(), make_course()
    slot_a, slot_b = make_slot(a, hour=9), make_slot(b, hour=11)  # 09-12 and 11-14 overlap
    student = make_student(courses=[a, b], branch=branch)
    DatesheetSelection.objects.create(
        student=student, course=a, slot=slot_a, branch=branch, during=slot_range(slot_a.start_at, slot_a.end_at)
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        DatesheetSelection.objects.create(
            student=student, course=b, slot=slot_b, branch=branch, during=slot_range(slot_b.start_at, slot_b.end_at)
        )


def test_back_to_back_exams_allowed(make_student, make_course, make_slot, branch):
    a, b = make_course(), make_course()
    slot_a, slot_b = make_slot(a, hour=9), make_slot(b, hour=12)  # 09-12 then 12-15
    student = make_student(courses=[a, b], branch=branch)
    for course, slot in ((a, slot_a), (b, slot_b)):
        DatesheetSelection.objects.create(
            student=student, course=course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
        )
    assert student.selections.count() == 2


def test_seat_capacity_never_overbooks(make_course, make_slot, branch):
    slot = make_slot(make_course(), capacity=1)
    reserve_seat(slot, branch)
    assert seats_left(slot, branch) == 0
    with pytest.raises(AppError) as error:
        reserve_seat(slot, branch)
    assert error.value.code == "SLOT_FULL"


def test_one_pending_request_per_type(make_student, branch):
    student = make_student(branch=branch)
    ChangeRequest.objects.create(student=student, type="change_branch", reason="Moved to another city")
    with pytest.raises(IntegrityError), transaction.atomic():
        ChangeRequest.objects.create(student=student, type="change_branch", reason="Second try")
    ChangeRequest.objects.create(student=student, type="change_datesheet", reason="Different type is fine")
