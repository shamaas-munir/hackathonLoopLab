import pytest

from apps.branches.models import Branch
from apps.core.models import AuditLog
from apps.scheduling.models import DatesheetSelection
from common.time import slot_range

pytestmark = pytest.mark.django_db

URL = "/api/v1/admin/branches/"
PAYLOAD = {
    "name": "Multan Campus",
    "code": "mul",
    "city": "Multan",
    "address": "Bosan Road, Multan",
    "contact_number": "061-6223344",
    "status": "active",
}


def test_create_uppercases_code_and_audits(admin_api):
    response = admin_api.post(URL, PAYLOAD)
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["code"] == "MUL" and body["students_count"] == 0
    assert AuditLog.objects.filter(entity="branch", action="create", entity_id=body["id"]).exists()


def test_update_and_retrieve(admin_api, branch):
    response = admin_api.patch(f"{URL}{branch.id}/", {"city": "  Lahore   City "})
    assert response.status_code == 200
    assert admin_api.get(f"{URL}{branch.id}/").json()["city"] == "Lahore City"


@pytest.mark.parametrize(
    "field,value",
    [("name", "A"), ("code", "L"), ("code", "TOO-LONG-CODE"), ("contact_number", "12345"), ("status", "closed")],
)
def test_validation_errors_are_422_with_field(admin_api, field, value):
    response = admin_api.post(URL, {**PAYLOAD, field: value})
    assert response.status_code == 422
    assert field in response.json()["error"]["field_errors"]


@pytest.mark.parametrize("number", ["03001234567", "0300-1234567", "+923001234567", "042-35761234"])
def test_accepted_contact_numbers(admin_api, number):
    assert admin_api.post(URL, {**PAYLOAD, "contact_number": number}).status_code == 201


def test_duplicate_code_is_409_with_field_error(admin_api, branch):
    response = admin_api.post(URL, {**PAYLOAD, "code": branch.code.lower()})
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "CONFLICT" and "code" in error["field_errors"]


def test_search_filter_and_filtered_count(admin_api, branch):
    Branch.objects.create(name="Quetta Campus", code="QTA", city="Quetta", address="Zarghoon Road", status="inactive")
    for i in range(11):
        Branch.objects.create(name=f"Town {i}", code=f"TWN{i}", city="Faisalabad", address="Main Road")

    page = admin_api.get(URL, {"search": "faisal", "page_size": 5}).json()
    assert page["count"] == 11 and page["total_pages"] == 3 and len(page["results"]) == 5

    inactive = admin_api.get(URL, {"status": "inactive"}).json()
    assert [b["code"] for b in inactive["results"]] == ["QTA"]

    ordered = admin_api.get(URL, {"ordering": "-code", "page_size": 5}).json()["results"]
    assert ordered[0]["code"] == "TWN9"


def test_students_count_annotation(admin_api, branch, make_student):
    make_student(branch=branch)
    make_student(branch=branch)
    row = admin_api.get(URL, {"search": branch.code}).json()["results"][0]
    assert row["students_count"] == 2


def test_delete_unused_branch(admin_api, branch):
    assert admin_api.delete(f"{URL}{branch.id}/").status_code == 204
    assert not Branch.objects.filter(pk=branch.pk).exists()
    assert AuditLog.objects.filter(entity="Lahore Campus (LHR)", action="delete").exists()


def test_delete_branch_chosen_by_student_is_409(admin_api, branch, make_student):
    make_student(branch=branch)
    response = admin_api.delete(f"{URL}{branch.id}/")
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "IN_USE"
    assert error["message"] == "This branch is chosen by 1 student. Mark it inactive instead."
    assert Branch.objects.filter(pk=branch.pk).exists()


def test_delete_branch_referenced_only_by_selection_is_409(admin_api, branch, make_student, make_course, make_slot):
    course = make_course()
    slot = make_slot(course)
    student = make_student(courses=[course])  # branch since cleared, but a booking still points at it
    DatesheetSelection.objects.create(
        student=student, course=course, slot=slot, branch=branch, during=slot_range(slot.start_at, slot.end_at)
    )
    assert admin_api.delete(f"{URL}{branch.id}/").status_code == 409


def test_toggle_status(admin_api, branch):
    response = admin_api.post(f"{URL}{branch.id}/toggle-status/")
    assert response.status_code == 200 and response.json()["status"] == "inactive"
    assert admin_api.post(f"{URL}{branch.id}/toggle-status/").json()["status"] == "active"
    assert AuditLog.objects.filter(entity="branch", action="update", entity_id=str(branch.id)).count() == 2


def test_student_gets_403_and_anonymous_401(api, make_student, student_api, branch):
    assert student_api(make_student()).get(URL).status_code == 403
    assert api.get(URL).status_code == 401
