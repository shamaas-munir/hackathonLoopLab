"""Designer reads and the save transaction (R2, R7-R11, R22, BN-1)."""

import pytest

from apps.notifications.models import EmailOutbox
from apps.scheduling import datesheet_service
from apps.scheduling.models import DatesheetSelection, SlotSeat
from apps.scheduling.seats import reserve_seat

pytestmark = pytest.mark.django_db
URL = "/api/v1/me/datesheet/"


@pytest.fixture
def setup(make_course, make_slot, make_student, branch):
    """Four courses on four separate days, plus an overlapping alternative for the second course."""
    courses = [make_course() for _ in range(4)]
    slots = [make_slot(course, days_ahead=10 + i) for i, course in enumerate(courses)]
    clash = make_slot(courses[1], days_ahead=10, hour=10)  # overlaps slots[0] (09:00-12:00)
    student = make_student(courses=courses, branch=branch)
    return student, courses, slots, clash


def body(courses, slots):
    return {"selections": [{"course": str(c.pk), "slot": str(s.pk)} for c, s in zip(courses, slots, strict=True)]}


def test_courses_lists_upcoming_slots_with_seats(student_api, setup, make_slot, branch):
    student, courses, slots, _ = setup
    past = make_slot(courses[0], days_ahead=-2)
    full = make_slot(courses[0], days_ahead=20, capacity=1)
    reserve_seat(full, branch)
    limited = make_slot(courses[0], days_ahead=21, capacity=8)

    response = student_api(student).get("/api/v1/me/courses/")
    assert response.status_code == 200
    first = next(item for item in response.json() if item["course"]["id"] == str(courses[0].pk))
    ids = {s["id"]: s["seats_left"] for s in first["slots"]}
    assert str(past.pk) not in ids and str(full.pk) not in ids  # past and full slots hidden
    assert ids[str(slots[0].pk)] is None and ids[str(limited.pk)] == 8
    assert first["selected_slot"] is None


def test_courses_query_count_is_constant(student_api, setup, django_assert_max_num_queries):
    student = setup[0]
    with django_assert_max_num_queries(8):
        assert student_api(student).get("/api/v1/me/courses/").status_code == 200


def test_save_success_locks_and_emails(student_api, setup):
    student, courses, slots, _ = setup
    client = student_api(student)
    response = client.post(URL, body(courses, slots))
    assert response.status_code == 201, response.json()
    data = response.json()
    assert [r["course_code"] for r in data["rows"]] == [c.code for c in courses]  # sorted by start
    assert data["locked"] is True

    student.refresh_from_db()
    assert student.datesheet_saved_at is not None
    assert DatesheetSelection.objects.filter(student=student).count() == 4
    assert EmailOutbox.objects.filter(template="datesheet_saved").count() == 1

    second = client.post(URL, body(courses, slots))
    assert second.status_code == 409 and second.json()["error"]["code"] == "LOCKED"


def test_incomplete_assignment_forbidden(student_api, make_student, make_course, make_slot, branch):
    courses = [make_course() for _ in range(3)]
    slots = [make_slot(c, days_ahead=10 + i) for i, c in enumerate(courses)]
    client = student_api(make_student(courses=courses, branch=branch))
    response = client.post(URL, body(courses, slots))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ASSIGNMENT_INCOMPLETE"
    assert client.get("/api/v1/me/courses/").status_code == 403


def test_missing_course_rejected(student_api, setup):
    student, courses, slots, _ = setup
    response = student_api(student).post(URL, body(courses[:3], slots[:3]))
    assert response.status_code == 422
    assert courses[3].code in response.json()["error"]["message"]


def test_slot_from_another_course_rejected(student_api, setup):
    student, courses, slots, _ = setup
    response = student_api(student).post(URL, body(courses, [slots[1], slots[0], slots[2], slots[3]]))
    assert response.status_code == 422
    assert DatesheetSelection.objects.count() == 0


def test_past_slot_rejected(student_api, setup, make_slot):
    student, courses, slots, _ = setup
    past = make_slot(courses[0], days_ahead=-1)
    response = student_api(student).post(URL, body(courses, [past, *slots[1:]]))
    assert response.status_code == 422


def test_overlap_rejected_with_course_names(student_api, setup):
    student, courses, slots, clash = setup
    response = student_api(student).post(URL, body(courses, [slots[0], clash, slots[2], slots[3]]))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "SLOT_CONFLICT"
    assert courses[0].code in error["message"] and courses[1].code in error["message"]


def test_exclusion_constraint_is_final_guard(student_api, setup, monkeypatch):
    student, courses, slots, clash = setup
    monkeypatch.setattr(datesheet_service, "overlaps", lambda *args: False)  # pretend the app check missed it
    response = student_api(student).post(URL, body(courses, [slots[0], clash, slots[2], slots[3]]))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SLOT_CONFLICT"
    assert SlotSeat.objects.filter(booked__gt=0).count() == 0  # seats rolled back too


def test_full_slot_rejected(student_api, setup, make_slot, branch):
    student, courses, slots, _ = setup
    full = make_slot(courses[0], days_ahead=30, capacity=1)
    reserve_seat(full, branch)
    response = student_api(student).post(URL, body(courses, [full, *slots[1:]]))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SLOT_FULL"
    student.refresh_from_db()
    assert student.datesheet_saved_at is None


def test_unlock_is_single_use_and_seats_move(student_api, setup, make_slot):
    student, courses, slots, _ = setup
    capped = make_slot(courses[0], days_ahead=40, capacity=1)
    client = student_api(student)
    assert client.post(URL, body(courses, slots)).status_code == 201

    student.datesheet_unlocked = True
    student.save(update_fields=["datesheet_unlocked"])
    assert client.post(URL, body(courses, [capped, *slots[1:]])).status_code == 201
    student.refresh_from_db()
    assert student.datesheet_unlocked is False
    assert SlotSeat.objects.get(slot=capped).booked == 1
    assert SlotSeat.objects.get(slot=slots[0]).booked == 0

    assert client.post(URL, body(courses, slots)).status_code == 409


def test_unchanged_full_slot_kept_on_resave(student_api, setup, make_slot):
    """Re-saving after an unlock must not fail on a full slot the student already holds."""
    student, courses, slots, _ = setup
    capped = make_slot(courses[0], days_ahead=40, capacity=1)
    client = student_api(student)
    assert client.post(URL, body(courses, [capped, *slots[1:]])).status_code == 201

    student.datesheet_unlocked = True
    student.save(update_fields=["datesheet_unlocked"])
    courses_view = client.get("/api/v1/me/courses/").json()
    first = next(item for item in courses_view if item["course"]["id"] == str(courses[0].pk))
    assert first["selected_slot"] == str(capped.pk)
    assert any(s["id"] == str(capped.pk) and s["seats_left"] == 0 for s in first["slots"])

    assert client.post(URL, body(courses, [capped, *slots[1:]])).status_code == 201
    assert SlotSeat.objects.get(slot=capped).booked == 1


def test_idempotency_key_replays_response(student_api, setup):
    student, courses, slots, _ = setup
    client = student_api(student)
    first = client.post(URL, body(courses, slots), HTTP_IDEMPOTENCY_KEY="abc-123")
    replay = client.post(URL, body(courses, slots), HTTP_IDEMPOTENCY_KEY="abc-123")
    assert first.status_code == replay.status_code == 201
    assert first.json() == replay.json()
    assert EmailOutbox.objects.filter(template="datesheet_saved").count() == 1


def test_datesheet_view_is_own_only(student_api, setup, make_student, branch):
    student, courses, slots, _ = setup
    student_api(student).post(URL, body(courses, slots))
    other = student_api(make_student(courses=courses, branch=branch))
    assert other.get(URL).status_code == 404
    mine = student_api(student).get(URL).json()
    assert mine["registration_no"] == student.registration_no and mine["branch"]["code"] == "LHR"
