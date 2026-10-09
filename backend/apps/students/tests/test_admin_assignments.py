import pytest
from django.utils import timezone

from apps.scheduling.models import DatesheetSelection, SlotSeat
from apps.scheduling.seats import reserve_seat
from common.time import slot_range

pytestmark = pytest.mark.django_db

STUDENTS = "/api/v1/admin/students/"
ASSIGNMENTS = "/api/v1/admin/assignments/"


def _url(student):
    return f"{STUDENTS}{student.pk}/assignments/"


@pytest.fixture
def courses(make_course):
    return [make_course() for _ in range(7)]


def test_replace_sets_exact_course_set(admin_api, make_student, courses):
    student = make_student(courses=courses[:4])
    wanted = [str(c.pk) for c in courses[2:7]]
    response = admin_api.put(_url(student), {"course_ids": wanted}, format="json")
    assert response.status_code == 200, response.json()
    assert response.json()["assignment_count"] == 5
    assert set(student.assignments.values_list("course_id", flat=True)) == {c.pk for c in courses[2:7]}


@pytest.mark.parametrize("count", [3, 7])
def test_replace_outside_4_to_6_is_422(admin_api, make_student, courses, count):
    student = make_student()
    response = admin_api.put(_url(student), {"course_ids": [str(c.pk) for c in courses[:count]]}, format="json")
    assert response.status_code == 422
    assert student.assignments.count() == 0


def test_replace_with_duplicate_ids_is_422(admin_api, make_student, courses):
    ids = [str(c.pk) for c in courses[:3]] + [str(courses[0].pk)]
    assert admin_api.put(_url(make_student()), {"course_ids": ids}, format="json").status_code == 422


def test_adding_seventh_course_is_422(admin_api, make_student, courses):
    student = make_student(courses=courses[:6])
    response = admin_api.post(_url(student), {"course_id": str(courses[6].pk)})
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "A student can have at most 6 courses."


def test_duplicate_course_is_409(admin_api, make_student, courses):
    student = make_student(courses=courses[:4])
    response = admin_api.post(_url(student), {"course_id": str(courses[0].pk)})
    assert response.status_code == 409
    assert response.json()["error"]["message"] == "Course already assigned."


def test_inactive_course_is_422(admin_api, make_student, make_course):
    student = make_student()
    inactive = make_course(status="inactive")
    response = admin_api.post(_url(student), {"course_id": str(inactive.pk)})
    assert response.status_code == 422 and inactive.code in response.json()["error"]["message"]


def test_add_while_incomplete_is_allowed(admin_api, make_student, courses):
    student = make_student(courses=courses[:2])
    response = admin_api.post(_url(student), {"course_id": str(courses[2].pk)})
    assert response.status_code == 200 and response.json()["assignment_count"] == 3


def test_remove_at_four_is_422_but_allowed_above_and_below(admin_api, make_student, courses):
    four = make_student(courses=courses[:4])
    response = admin_api.delete(f"{ASSIGNMENTS}{four.assignments.first().pk}/")
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "A student must keep at least 4 courses."

    five = make_student(courses=courses[:5])
    assert admin_api.delete(f"{ASSIGNMENTS}{five.assignments.first().pk}/").status_code == 204

    three = make_student(courses=courses[:3])  # already INCOMPLETE: removal still allowed
    assert admin_api.delete(f"{ASSIGNMENTS}{three.assignments.first().pk}/").status_code == 204


def _save_datesheet(student, courses, make_slot, branch):
    for hour, course in zip(range(8, 20, 3), courses, strict=False):
        slot = make_slot(course, hour=hour, hours=2, capacity=5)
        reserve_seat(slot, branch)
        DatesheetSelection.objects.create(
            student=student, course=course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
        )
    student.datesheet_saved_at = timezone.now()
    student.save(update_fields=["datesheet_saved_at"])


def test_changes_after_saved_datesheet_are_locked(admin_api, make_student, courses, make_slot, branch):
    student = make_student(courses=courses[:5], branch=branch)
    _save_datesheet(student, courses[:4], make_slot, branch)

    for response in (
        admin_api.post(_url(student), {"course_id": str(courses[5].pk)}),
        admin_api.put(_url(student), {"course_ids": [str(c.pk) for c in courses[:4]]}, format="json"),
        admin_api.delete(f"{ASSIGNMENTS}{student.assignments.first().pk}/"),
    ):
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "LOCKED"
    assert student.assignments.count() == 5


def test_unlocked_datesheet_allows_changes_and_drops_selections(admin_api, make_student, courses, make_slot, branch):
    student = make_student(courses=courses[:4], branch=branch)
    _save_datesheet(student, courses[:4], make_slot, branch)
    student.datesheet_unlocked = True
    student.save(update_fields=["datesheet_unlocked"])
    dropped = courses[0]

    wanted = [str(c.pk) for c in courses[1:6]]
    assert admin_api.put(_url(student), {"course_ids": wanted}, format="json").status_code == 200
    assert not DatesheetSelection.objects.filter(student=student, course=dropped).exists()
    assert DatesheetSelection.objects.filter(student=student).count() == 3
    assert SlotSeat.objects.get(slot__course=dropped, branch=branch).booked == 0


def test_assignment_list_search_filter_and_pagination(admin_api, make_student, courses, program):
    alpha = make_student(courses=courses[:4], full_name="S3 Alpha")
    make_student(courses=courses[:5], full_name="S3 Beta")

    by_name = admin_api.get(ASSIGNMENTS, {"search": "alpha", "page_size": 5}).json()
    assert by_name["count"] == 4 and by_name["total_pages"] == 1
    assert by_name["results"][0]["student_course_count"] == 4

    by_course = admin_api.get(ASSIGNMENTS, {"course": str(courses[4].pk)}).json()
    assert by_course["count"] == 1 and by_course["results"][0]["student_name"] == "S3 Beta"

    by_code = admin_api.get(ASSIGNMENTS, {"search": courses[0].code, "program": str(program.pk)}).json()
    assert by_code["count"] == 2
    assert alpha.full_name in {row["student_name"] for row in by_code["results"]}
