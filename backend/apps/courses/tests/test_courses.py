import pytest

from apps.core.models import AuditLog
from apps.courses.models import Course, Department

pytestmark = pytest.mark.django_db

URL = "/api/v1/admin/courses/"
DEPT_URL = "/api/v1/admin/departments/"


@pytest.fixture
def payload(department):
    return {"code": "cs999", "title": "Compilers", "credit_hours": 3, "department": str(department.id)}


def test_create_course(admin_api, payload, department):
    response = admin_api.post(URL, payload)
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["code"] == "CS999" and body["status"] == "active"
    assert body["department_name"] == department.name
    assert body["slots_count"] == 0 and body["assignments_count"] == 0
    assert AuditLog.objects.filter(entity="course", action="create").exists()


@pytest.mark.parametrize(
    "field,value", [("credit_hours", 0), ("credit_hours", 7), ("code", "101CS"), ("title", "X"), ("department", "")]
)
def test_course_validation(admin_api, payload, field, value):
    response = admin_api.post(URL, {**payload, field: value})
    assert response.status_code == 422
    assert field in response.json()["error"]["field_errors"]


def test_duplicate_course_code_is_409(admin_api, payload, make_course):
    make_course(code="CS999")
    response = admin_api.post(URL, payload)
    assert response.status_code == 409
    assert "code" in response.json()["error"]["field_errors"]


def test_update_course(admin_api, make_course):
    course = make_course()
    response = admin_api.patch(f"{URL}{course.id}/", {"status": "inactive", "credit_hours": 4})
    assert response.status_code == 200
    course.refresh_from_db()
    assert course.status == "inactive" and course.credit_hours == 4


def test_list_search_filters_counts(admin_api, make_course, make_slot, make_student, department):
    math = Department.objects.create(name="Mathematics", code="MTH")
    cs = make_course(code="CS101", title="Intro to Computing")
    make_course(code="MTH101", title="Calculus", department=math, status="inactive")
    make_slot(cs)
    make_slot(cs, days_ahead=11)
    make_student(courses=[cs])

    by_dept = admin_api.get(URL, {"search": "mathem"}).json()
    assert by_dept["count"] == 1 and by_dept["results"][0]["code"] == "MTH101"
    assert admin_api.get(URL, {"status": "inactive"}).json()["count"] == 1
    assert admin_api.get(URL, {"department": str(department.id)}).json()["count"] == 1

    row = admin_api.get(URL, {"search": "CS101"}).json()["results"][0]
    assert row["slots_count"] == 2 and row["assignments_count"] == 1


def test_list_has_no_n_plus_one(admin_api, make_course, django_assert_max_num_queries):
    for _ in range(8):
        make_course()
    with django_assert_max_num_queries(3):
        assert admin_api.get(URL).status_code == 200


def test_delete_unused_course(admin_api, make_course):
    course = make_course()
    assert admin_api.delete(f"{URL}{course.id}/").status_code == 204
    assert not Course.objects.filter(pk=course.pk).exists()


def test_delete_course_with_slots_is_409(admin_api, make_course, make_slot):
    course = make_course()
    make_slot(course)
    response = admin_api.delete(f"{URL}{course.id}/")
    assert response.status_code == 409
    assert response.json()["error"]["message"] == "This course has 1 exam slot. Mark it inactive instead."


def test_delete_assigned_course_is_409(admin_api, make_course, make_student):
    course = make_course()
    make_student(courses=[course])
    make_student(courses=[course])
    response = admin_api.delete(f"{URL}{course.id}/")
    assert response.status_code == 409
    assert "assigned to 2 students" in response.json()["error"]["message"]


def test_department_crud(admin_api):
    created = admin_api.post(DEPT_URL, {"name": "Physics", "code": "phy"})
    assert created.status_code == 201 and created.json()["code"] == "PHY"
    dept_id = created.json()["id"]

    assert admin_api.patch(f"{DEPT_URL}{dept_id}/", {"name": "Applied Physics"}).status_code == 200
    listing = admin_api.get(DEPT_URL, {"search": "applied"}).json()
    assert listing["count"] == 1 and listing["results"][0]["courses_count"] == 0

    assert admin_api.delete(f"{DEPT_URL}{dept_id}/").status_code == 204


def test_duplicate_department_code_is_409(admin_api, department):
    response = admin_api.post(DEPT_URL, {"name": "Comp Sci", "code": "cs"})
    assert response.status_code == 409
    assert "code" in response.json()["error"]["field_errors"]


def test_delete_department_in_use_is_409(admin_api, department, make_course):
    make_course()
    response = admin_api.delete(f"{DEPT_URL}{department.id}/")
    assert response.status_code == 409 and response.json()["error"]["code"] == "IN_USE"


@pytest.mark.parametrize("url", [URL, DEPT_URL])
def test_student_gets_403(make_student, student_api, url):
    assert student_api(make_student()).get(url).status_code == 403
