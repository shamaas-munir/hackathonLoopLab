import io
from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.accounts.models import User
from apps.core.models import AuditLog
from apps.notifications.models import EmailOutbox
from apps.students.models import Program, Student
from conftest import PASSWORD

pytestmark = pytest.mark.django_db

URL = "/api/v1/admin/students/"


@pytest.fixture
def payload(program):
    return {
        "full_name": "S3 Hina Malik",
        "email": "S3.Hina@Example.com",
        "phone": "0300-1234567",
        "cnic": "35202-1111111-1",
        "date_of_birth": "2004-05-01",
        "gender": "female",
        "address": "House 1, Lahore",
        "guardian_name": "Tariq Malik",
        "guardian_cnic": "35202-2222222-1",
        "guardian_occupation": "Engineer",
        "guardian_contact": "0301-7654321",
        "emergency_contact": "0301-7654321",
        "registration_no": "vu-2024-0101",
        "program": str(program.pk),
        "semester": 2,
        "session": "2024-2028",
        "previous_qualification": "FSc",
        "previous_institute": "Govt College",
        "marks_or_cgpa": "3.40",
    }


def _image(fmt="PNG", size=(10, 10)):
    buffer = io.BytesIO()
    Image.new("RGB", size).save(buffer, fmt)
    return buffer.getvalue()


def test_create_student_queues_setup_email_and_is_invited(admin_api, payload):
    response = admin_api.post(URL, payload)
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["email_queued"] is True
    assert body["email"] == "s3.hina@example.com"
    assert body["registration_no"] == "VU-2024-0101"
    assert body["account_status"] == "invited"

    user = User.objects.get(email="s3.hina@example.com")
    assert user.role == "student" and not user.has_usable_password()
    assert EmailOutbox.objects.filter(to=user.email, template="account_setup").exists()
    assert AuditLog.objects.filter(entity="student", action="create").exists()


@pytest.mark.parametrize("field", ["email", "cnic", "registration_no"])
def test_duplicate_unique_fields_return_409_with_field_errors(admin_api, payload, make_student, field):
    existing = make_student()
    clash = {"email": existing.user.email.upper(), "cnic": existing.cnic, "registration_no": existing.registration_no}
    response = admin_api.post(URL, {**payload, field: clash[field].lower() if field != "email" else clash[field]})
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "CONFLICT" and field in error["field_errors"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("cnic", "3520211111111"),
        ("full_name", "Al"),
        ("date_of_birth", date.today().replace(year=date.today().year - 10).isoformat()),
        ("semester", 13),
        ("session", "2028-2024"),
        ("marks_or_cgpa", "1200"),
        ("phone", "abc"),
    ],
)
def test_invalid_fields_return_422(admin_api, payload, field, value):
    response = admin_api.post(URL, {**payload, field: value})
    assert response.status_code == 422
    assert field in response.json()["error"]["field_errors"]


def test_photo_upload_validates_type_and_size(admin_api, payload):
    gif = SimpleUploadedFile("a.gif", _image("GIF"), content_type="image/gif")
    response = admin_api.post(URL, {**payload, "photo": gif}, format="multipart")
    assert response.status_code == 422 and "photo" in response.json()["error"]["field_errors"]

    png = SimpleUploadedFile("a.png", _image(), content_type="image/png")
    response = admin_api.post(URL, {**payload, "photo": png}, format="multipart")
    assert response.status_code == 201
    student = Student.objects.get(pk=response.json()["id"])
    assert student.photo.name.startswith("students/photos/")
    student.photo.delete(save=False)


def test_list_is_paginated_with_filtered_count_and_annotations(admin_api, make_student, make_course, branch):
    courses = [make_course() for _ in range(4)]
    make_student(courses=courses, branch=branch, full_name="S3 Complete")
    for i in range(3):
        make_student(courses=courses[:2], full_name=f"S3 Partial {i}")

    response = admin_api.get(URL, {"assignment": "incomplete", "page_size": 5})
    body = response.json()
    assert response.status_code == 200
    assert body["count"] == 3 and body["total_pages"] == 1
    assert {row["assignment_count"] for row in body["results"]} == {2}

    complete = admin_api.get(URL, {"assignment": "complete", "search": "s3 comp"}).json()
    assert complete["count"] == 1
    row = complete["results"][0]
    assert row["branch_name"] == branch.name and row["account_status"] == "active"

    invited = admin_api.get(URL, {"account": "invited"}).json()
    assert invited["count"] == 0


def test_list_has_no_n_plus_one(admin_api, make_student, make_course, branch, django_assert_max_num_queries):
    courses = [make_course() for _ in range(4)]
    for _ in range(8):
        make_student(courses=courses, branch=branch)
    with django_assert_max_num_queries(4):
        assert admin_api.get(URL).status_code == 200


def test_retrieve_includes_assignments_and_flow_data(admin_api, make_student, make_course):
    student = make_student(courses=[make_course() for _ in range(4)])
    body = admin_api.get(f"{URL}{student.pk}/").json()
    assert len(body["assignments"]) == 4
    assert body["branch"] is None and body["selections"] == [] and body["requests"] == []


def test_update_uses_optimistic_lock_and_changes_email(admin_api, make_student):
    student = make_student()
    url = f"{URL}{student.pk}/"
    body = admin_api.get(url).json()
    body.update(email="S3.new@example.com", full_name="S3 Renamed")
    for key in ("photo", "branch", "assignments", "selections", "requests"):
        body.pop(key)

    first = admin_api.put(url, body)
    assert first.status_code == 200, first.json()
    assert first.json()["version"] == 2 and first.json()["email"] == "s3.new@example.com"

    stale = admin_api.put(url, body)  # still carries version 1
    assert stale.status_code == 409
    assert "reload" in stale.json()["error"]["message"]


def test_update_rejects_email_of_another_user(admin_api, make_student, admin_user):
    student = make_student()
    response = admin_api.patch(f"{URL}{student.pk}/", {"email": admin_user.email, "version": 1})
    assert response.status_code == 409 and "email" in response.json()["error"]["field_errors"]


def test_delete_cascades_to_user(admin_api, make_student, make_course):
    student = make_student(courses=[make_course() for _ in range(4)])
    assert admin_api.delete(f"{URL}{student.pk}/").status_code == 204
    assert not User.objects.filter(pk=student.user_id).exists()


def test_resend_invite_only_while_invited(admin_api, payload, make_student):
    created = admin_api.post(URL, payload).json()
    assert admin_api.post(f"{URL}{created['id']}/resend-invite/").status_code == 204
    assert EmailOutbox.objects.filter(template="account_setup").count() == 2

    active = make_student()  # fixture students already have a password
    response = admin_api.post(f"{URL}{active.pk}/resend-invite/")
    assert response.status_code == 409 and "Forgot password" in response.json()["error"]["message"]


def test_students_cannot_use_admin_endpoints(make_student, student_api):
    student = make_student()
    assert student_api(student).get(URL).status_code == 403


def test_programs_crud_and_delete_blocked_when_used(admin_api, program, make_student):
    created = admin_api.post("/api/v1/admin/programs/", {"name": "BS Physics", "code": "bsph", "duration_semesters": 8})
    assert created.status_code == 201 and created.json()["code"] == "BSPH"

    duplicate = admin_api.post("/api/v1/admin/programs/", {"name": "Other", "code": "BSPH", "duration_semesters": 8})
    assert duplicate.status_code == 409

    listing = admin_api.get("/api/v1/admin/programs/", {"search": "physics"}).json()
    assert listing["count"] == 1

    make_student()  # uses `program`
    assert admin_api.delete(f"/api/v1/admin/programs/{program.pk}/").status_code == 409
    assert admin_api.delete(f"/api/v1/admin/programs/{created.json()['id']}/").status_code == 204
    assert not Program.objects.filter(code="BSPH").exists()


def test_login_password_still_works_after_admin_edit(api, admin_api, make_student):
    student = make_student()
    admin_api.patch(f"{URL}{student.pk}/", {"full_name": "S3 Edited", "version": 1})
    response = api.post("/api/v1/auth/login/", {"email": student.user.email, "password": PASSWORD})
    assert response.status_code == 200
