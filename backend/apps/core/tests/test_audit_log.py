"""Audit log API (bonus BN-5)."""

import pytest

from common import audit

pytestmark = pytest.mark.django_db
URL = "/api/v1/admin/audit-log/"


def test_list_is_newest_first_with_filters_and_search(admin_api, admin_user, branch, make_course):
    audit.log_audit(admin_user, audit.CREATE, branch)
    audit.log_audit(admin_user, audit.UPDATE, make_course(code="CS101"), {"fields": ["title"]})

    body = admin_api.get(URL).json()
    assert body["count"] == 2
    assert body["results"][0]["entity"] == "course" and body["results"][0]["actor"] == admin_user.email

    assert admin_api.get(URL, {"action": "create"}).json()["count"] == 1
    assert admin_api.get(URL, {"entity": "branch"}).json()["count"] == 1
    assert admin_api.get(URL, {"search": "cs101"}).json()["count"] == 1
    assert admin_api.get(URL, {"search": "title"}).json()["count"] == 1  # searches JSON details too


def test_students_cannot_read_audit_log(student_api, make_student):
    assert student_api(make_student()).get(URL).status_code == 403
