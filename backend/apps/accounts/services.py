from django.contrib.auth import authenticate

from apps.accounts.tokens import SETUP, bump_nonce, make_password_link
from common.emails import queue_email
from common.exceptions import AppError


def login(email: str, password: str):
    user = authenticate(email=email.strip().lower(), password=password)
    if user is None or not user.is_active:
        raise AppError("UNAUTHORIZED", "Invalid email or password.", 401)
    return user


def home_route(user) -> str:
    if user.role == "admin":
        return "/admin"
    from apps.students.state import flow_state

    return flow_state(user.student)["home_route"]


def me_payload(user) -> dict:
    flow = None
    name = user.email
    if user.role == "student" and hasattr(user, "student"):
        from apps.students.state import flow_state

        flow = flow_state(user.student)
        name = user.student.full_name
    return {"id": user.pk, "email": user.email, "role": user.role, "name": name, "flow": flow}


def send_account_setup_email(user) -> None:
    """Queue the 'your portal account was created' email with a fresh 24 h single-use link."""
    bump_nonce(user)
    name = user.student.full_name if hasattr(user, "student") else user.email
    queue_email(user.email, "account_setup", {"name": name, "link": make_password_link(user, SETUP)})
