from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from apps.accounts.models import Role, User
from apps.accounts.tokens import GENERATORS, RESET, SETUP, bump_nonce, make_password_link, resolve_token
from common.emails import queue_email
from common.exceptions import AppError


def _link_invalid() -> AppError:
    return AppError("LINK_INVALID", "This link has expired or has already been used. Please request a new one.")


def login(email: str, password: str):
    # authenticate() rejects inactive users and unusable passwords; one generic message avoids leaking which.
    user = authenticate(email=email.strip().lower(), password=password)
    if user is None or not user.is_active:
        raise AppError("UNAUTHORIZED", "Invalid email or password.", 401)
    return user


def display_name(user) -> str:
    if user.role == Role.STUDENT and hasattr(user, "student"):
        return user.student.full_name
    return user.email


def home_route(user) -> str:
    if user.role == Role.ADMIN:
        return "/admin"
    from apps.students.state import flow_state

    return flow_state(user.student)["home_route"]


def me_payload(user) -> dict:
    flow = None
    if user.role == Role.STUDENT and hasattr(user, "student"):
        from apps.students.state import flow_state

        flow = flow_state(user.student)
    return {"id": user.pk, "email": user.email, "role": user.role, "name": display_name(user), "flow": flow}


def _send_password_link(user, purpose: str, template: str) -> None:
    bump_nonce(user)  # revokes every older link (D11)
    queue_email(user.email, template, {"name": display_name(user), "link": make_password_link(user, purpose)})


def send_account_setup_email(user) -> None:
    """Queue the 'your portal account was created' email with a fresh 24 h single-use link."""
    _send_password_link(user, SETUP, "account_setup")


def request_password_reset(email: str) -> None:
    """Send a 1 h reset link if an active account exists. Callers always respond the same way (D12)."""
    user = User.objects.filter(email=email.strip().lower(), is_active=True).select_related("student").first()
    if user is not None:
        with transaction.atomic():
            _send_password_link(user, RESET, "password_reset")


def _resolve(uid: str, token: str, purpose: str):
    try:
        return resolve_token(uid, token, purpose)
    except DjangoValidationError:  # uid decodes to something that isn't a UUID
        return None


def validate_link(uid: str, token: str, purpose: str) -> dict:
    user = _resolve(uid, token, purpose)
    if user is None:
        return {"valid": False}
    return {"valid": True, "purpose": purpose, "name": display_name(user), "email": user.email}


def set_password(uid: str, token: str, purpose: str, password: str) -> None:
    user = _resolve(uid, token, purpose)
    if user is None:
        raise _link_invalid()
    with transaction.atomic():
        # Lock the row and re-check, so two concurrent submissions can't both redeem one link.
        user = User.objects.select_for_update().get(pk=user.pk)
        if not GENERATORS[purpose].check_token(user, token):
            raise _link_invalid()
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            message = exc.messages[0]
            raise AppError("VALIDATION", message, 422, {"password": message}) from None
        user.set_password(password)
        user.save(update_fields=["password"])
        bump_nonce(user)
