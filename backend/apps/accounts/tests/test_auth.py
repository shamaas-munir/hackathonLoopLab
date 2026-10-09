import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail
from django.core.cache import cache
from freezegun import freeze_time

from apps.accounts.models import User
from apps.accounts.services import send_account_setup_email
from apps.accounts.tokens import RESET, SETUP, bump_nonce, make_password_link
from apps.notifications.models import EmailOutbox
from conftest import PASSWORD

LOGIN = "/api/v1/auth/login/"
FORGOT = "/api/v1/auth/forgot-password/"
VALIDATE = "/api/v1/auth/validate-token/"
SET_PASSWORD = "/api/v1/auth/set-password/"
NEW_PASSWORD = "Exam2026slot"


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    cache.clear()


def ago(delta: timedelta) -> datetime:
    # Token timestamps use naive local time (datetime.now()), so freeze relative to that.
    return datetime.now() - delta


def link_parts(link: str) -> dict:
    """`/set-password/{uid}/{token}?purpose=...` -> API payload."""
    url = urlparse(link)
    _, _, uid, token = url.path.split("/")
    return {"uid": uid, "token": token, "purpose": parse_qs(url.query)["purpose"][0]}


def set_password(api, parts, password=NEW_PASSWORD, confirm=None):
    return api.post(SET_PASSWORD, {**parts, "password": password, "confirm_password": confirm or password})


@pytest.fixture
def new_student(make_student):
    """A freshly created student: no usable password until the setup link is used."""
    student = make_student()
    student.user.set_unusable_password()
    student.user.save()
    return student


# --- login ---------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_login_sets_cookies_and_redirects_to_admin(api, admin_user):
    response = api.post(LOGIN, {"email": "  ADMIN@test.local ", "password": PASSWORD})
    assert response.status_code == 200
    assert response.json() == {"role": "admin", "redirect_to": "/admin"}
    assert {"access", "refresh", "role"} <= set(response.cookies)
    assert response.cookies["access"]["httponly"]
    assert not response.cookies["role"]["httponly"]


@pytest.mark.django_db
def test_student_login_redirects_by_flow_state(api, make_student):
    student = make_student()  # no branch yet
    response = api.post(LOGIN, {"email": student.user.email, "password": PASSWORD})
    assert response.status_code == 200
    assert response.json() == {"role": "student", "redirect_to": "/student/select-branch"}

    me = api.get("/api/v1/auth/me/")
    assert me.status_code == 200
    assert me.json()["name"] == student.full_name
    assert me.json()["flow"]["home_route"] == "/student/select-branch"


@pytest.mark.django_db
@pytest.mark.parametrize("case", ["wrong_password", "unknown_email", "inactive", "no_password"])
def test_login_failures_share_one_generic_message(api, admin_user, new_student, case):
    email, password = admin_user.email, PASSWORD
    if case == "wrong_password":
        password = "Wrong-pass1"
    elif case == "unknown_email":
        email = "nobody@test.local"
    elif case == "inactive":
        User.objects.filter(pk=admin_user.pk).update(is_active=False)
    else:
        email, password = new_student.user.email, ""

    response = api.post(LOGIN, {"email": email, "password": password or "anything1"})
    assert response.status_code == 401
    assert response.json()["error"] == {
        "code": "UNAUTHORIZED",
        "message": "Invalid email or password.",
        "field_errors": {},
    }
    assert "access" not in response.cookies


@pytest.mark.django_db
def test_sixth_login_attempt_is_rate_limited(api, admin_user):
    for _ in range(5):
        assert api.post(LOGIN, {"email": admin_user.email, "password": "Wrong-pass1"}).status_code == 401
    response = api.post(LOGIN, {"email": admin_user.email, "password": PASSWORD})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.django_db
def test_logout_clears_cookies(api, admin_user):
    api.post(LOGIN, {"email": admin_user.email, "password": PASSWORD})
    response = api.post("/api/v1/auth/logout/")
    assert response.status_code == 204
    assert response.cookies["access"].value == ""
    assert api.get("/api/v1/auth/me/").status_code == 401


@pytest.mark.django_db
def test_refresh_issues_new_cookies(api, admin_user):
    api.post(LOGIN, {"email": admin_user.email, "password": PASSWORD})
    response = api.post("/api/v1/auth/refresh/")
    assert response.status_code == 204
    assert "access" in response.cookies


# --- forgot password -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_forgot_password_response_is_identical_for_unknown_email(api, admin_user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        known = api.post(FORGOT, {"email": admin_user.email})
        unknown = api.post(FORGOT, {"email": "ghost@test.local"})

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert EmailOutbox.objects.filter(to=admin_user.email, template="password_reset").count() == 1
    assert EmailOutbox.objects.filter(to="ghost@test.local").count() == 0
    assert len(mail.outbox) == 1
    assert "purpose=reset" in mail.outbox[0].body
    assert PASSWORD not in mail.outbox[0].body


@pytest.mark.django_db
def test_forgot_password_ignores_inactive_users(api, admin_user):
    User.objects.filter(pk=admin_user.pk).update(is_active=False)
    assert api.post(FORGOT, {"email": admin_user.email}).status_code == 200
    assert not EmailOutbox.objects.exists()


@pytest.mark.django_db
def test_forgot_password_is_rate_limited(api, admin_user):
    for _ in range(3):
        assert api.post(FORGOT, {"email": admin_user.email}).status_code == 200
    assert api.post(FORGOT, {"email": admin_user.email}).status_code == 429


# --- setup link ----------------------------------------------------------------------------------


@pytest.mark.django_db
def test_setup_email_links_to_set_password_page(new_student, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        send_account_setup_email(new_student.user)

    message = mail.outbox[0]
    assert message.to == [new_student.user.email]
    assert new_student.full_name in message.body
    assert re.search(r"/set-password/[^/\s]+/[^/\s]+\?purpose=setup", message.body)
    assert "24 hours" in message.body


@pytest.mark.django_db
def test_setup_link_validates_sets_password_and_works_once(api, new_student):
    parts = link_parts(make_password_link(new_student.user, SETUP))

    check = api.post(VALIDATE, parts)
    assert check.json() == {
        "valid": True,
        "purpose": "setup",
        "name": new_student.full_name,
        "email": new_student.user.email,
    }

    response = set_password(api, parts)
    assert response.status_code == 200
    assert NEW_PASSWORD not in response.content.decode()
    assert api.post(LOGIN, {"email": new_student.user.email, "password": NEW_PASSWORD}).status_code == 200

    assert api.post(VALIDATE, parts).json() == {"valid": False}
    reuse = set_password(api, parts, password="Another2026x")
    assert reuse.status_code == 400
    assert reuse.json()["error"]["code"] == "LINK_INVALID"


@pytest.mark.django_db
def test_new_link_invalidates_older_link(api, new_student):
    old = link_parts(make_password_link(new_student.user, SETUP))
    bump_nonce(new_student.user)
    new = link_parts(make_password_link(new_student.user, SETUP))

    assert api.post(VALIDATE, old).json() == {"valid": False}
    assert set_password(api, old).status_code == 400
    assert set_password(api, new).status_code == 200


@pytest.mark.django_db
def test_setup_link_expires_after_24_hours(api, new_student):
    with freeze_time(ago(timedelta(hours=24, minutes=1))):
        parts = link_parts(make_password_link(new_student.user, SETUP))
    assert api.post(VALIDATE, parts).json() == {"valid": False}


@pytest.mark.django_db
def test_reset_link_older_than_one_hour_is_rejected(api, admin_user):
    with freeze_time(ago(timedelta(minutes=61))):
        expired = link_parts(make_password_link(admin_user, RESET))
    assert set_password(api, expired).status_code == 400

    with freeze_time(ago(timedelta(minutes=59))):
        fresh = link_parts(make_password_link(admin_user, RESET))
    assert set_password(api, fresh).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: {**p, "token": p["token"][:-1] + ("a" if p["token"][-1] != "a" else "b")},
        lambda p: {**p, "uid": "bm90LWEtdXVpZA"},
        lambda p: {**p, "purpose": RESET},
        lambda p: {**p, "purpose": "admin"},
    ],
    ids=["tampered_token", "bad_uid", "wrong_purpose", "unknown_purpose"],
)
def test_tampered_links_are_invalid(api, new_student, mutate):
    parts = mutate(link_parts(make_password_link(new_student.user, SETUP)))
    assert api.post(VALIDATE, parts).json() == {"valid": False}


# --- password strength ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("password", "confirm", "field"),
    [
        ("Ab1", None, "password"),  # too short
        ("password1", None, "password"),  # too common
        ("12345678901", None, "password"),  # numeric only
        ("onlyletters", None, "password"),  # no digit
        (NEW_PASSWORD, "Different99", "confirm_password"),
    ],
)
def test_set_password_rejects_weak_or_mismatched_passwords(api, new_student, password, confirm, field):
    parts = link_parts(make_password_link(new_student.user, SETUP))
    response = set_password(api, parts, password=password, confirm=confirm)
    assert response.status_code == 422
    assert field in response.json()["error"]["field_errors"]
    new_student.user.refresh_from_db()
    assert not new_student.user.has_usable_password()
    assert api.post(VALIDATE, parts).json()["valid"] is True  # a failed attempt doesn't burn the link
