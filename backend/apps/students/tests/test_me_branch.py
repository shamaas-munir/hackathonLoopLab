"""Student profile + one-time branch selection (R5, R6, D7, D9, R13)."""

import threading

import pytest
from django.db import connection

from apps.branches.models import Branch
from apps.scheduling.models import DatesheetSelection, SlotSeat
from apps.scheduling.seats import reserve_seat
from apps.students.me_services import select_branch
from apps.students.models import Student
from common.exceptions import AppError
from common.time import slot_range

pytestmark = pytest.mark.django_db


@pytest.fixture
def other_branch(db):
    return Branch.objects.create(
        name="Karachi Campus", code="KHI", city="Karachi", address="2 Shahrah-e-Faisal", contact_number="021-1234567"
    )


def test_branches_lists_only_active(student_api, make_student, branch, other_branch):
    other_branch.status = "inactive"
    other_branch.save()
    response = student_api(make_student()).get("/api/v1/me/branches/")
    assert response.status_code == 200
    assert [b["code"] for b in response.json()] == ["LHR"]


def test_select_branch_once(student_api, make_student, branch, other_branch):
    student = make_student()
    client = student_api(student)

    first = client.post("/api/v1/me/branch/", {"branch": str(branch.pk)})
    assert first.status_code == 200 and first.json()["code"] == "LHR"

    second = client.post("/api/v1/me/branch/", {"branch": str(other_branch.pk)})
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "LOCKED"
    student.refresh_from_db()
    assert student.branch == branch and student.branch_selected_at is not None


def test_inactive_branch_rejected(student_api, make_student, other_branch):
    other_branch.status = "inactive"
    other_branch.save()
    response = student_api(make_student()).post("/api/v1/me/branch/", {"branch": str(other_branch.pk)})
    assert response.status_code == 422
    assert "branch" in response.json()["error"]["field_errors"]


def test_unlock_allows_one_change_and_moves_seats(
    student_api, make_student, make_course, make_slot, branch, other_branch
):
    course = make_course()
    slot = make_slot(course, capacity=5)
    student = make_student(courses=[course], branch=branch, branch_unlocked=True)
    reserve_seat(slot, branch)
    DatesheetSelection.objects.create(
        student=student, course=course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
    )
    client = student_api(student)

    assert client.post("/api/v1/me/branch/", {"branch": str(other_branch.pk)}).status_code == 200
    student.refresh_from_db()
    assert student.branch == other_branch and student.branch_unlocked is False
    assert DatesheetSelection.objects.get(student=student).branch == other_branch
    assert SlotSeat.objects.get(slot=slot, branch=branch).booked == 0
    assert SlotSeat.objects.get(slot=slot, branch=other_branch).booked == 1

    # Unlock consumed: a second change is refused.
    assert client.post("/api/v1/me/branch/", {"branch": str(branch.pk)}).status_code == 409


def test_branch_change_blocked_when_new_branch_full(
    student_api, make_student, make_course, make_slot, branch, other_branch
):
    course = make_course()
    slot = make_slot(course, capacity=1)
    reserve_seat(slot, other_branch)  # someone else has the only seat there
    student = make_student(courses=[course], branch=branch, branch_unlocked=True)
    reserve_seat(slot, branch)
    DatesheetSelection.objects.create(
        student=student, course=course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
    )

    response = student_api(student).post("/api/v1/me/branch/", {"branch": str(other_branch.pk)})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SLOT_FULL"
    student.refresh_from_db()
    assert student.branch == branch and student.branch_unlocked is True  # rolled back, unlock kept


@pytest.mark.django_db(transaction=True)
def test_concurrent_branch_selection_only_one_wins(make_student, branch, other_branch):
    student = make_student()
    results = []
    barrier = threading.Barrier(2)

    def pick(target):
        barrier.wait()
        try:
            select_branch(student, target.pk)
            results.append("ok")
        except AppError as exc:
            results.append(exc.code)
        finally:
            connection.close()

    threads = [threading.Thread(target=pick, args=(b,)) for b in (branch, other_branch)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == ["LOCKED", "ok"]
    assert Student.objects.get(pk=student.pk).branch_id is not None


def test_profile_returns_own_data_only(student_api, make_student, branch):
    me, other = make_student(branch=branch), make_student()
    body = student_api(me).get("/api/v1/me/profile/").json()
    assert body["academic"]["registration_no"] == me.registration_no
    assert body["personal"]["email"] == me.user.email
    assert body["branch"]["code"] == "LHR"
    assert body["flow"]["has_branch"] is True
    assert other.registration_no not in str(body)


def test_admin_cannot_use_student_endpoints(admin_api):
    assert admin_api.get("/api/v1/me/profile/").status_code == 403
