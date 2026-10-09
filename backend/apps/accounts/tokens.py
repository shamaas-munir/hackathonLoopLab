"""Single-use, time-limited password links (R19, D11).

Tokens are HMAC-signed (nothing stored in the DB). The hash includes the password hash and
`token_nonce`, so a link dies as soon as the password is set or a newer link is issued.
"""

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.db.models import F
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str
from django.utils.http import base36_to_int, urlsafe_base64_decode, urlsafe_base64_encode

SETUP, RESET = "setup", "reset"


class PasswordLinkTokenGenerator(PasswordResetTokenGenerator):
    def __init__(self, purpose: str, timeout_seconds: int):
        super().__init__()
        self.key_salt = f"examslot.accounts.tokens.{purpose}"
        self.timeout_seconds = timeout_seconds

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.password}{user.token_nonce}{timestamp}{user.is_active}"

    def check_token(self, user, token):
        if not (user and token):
            return False
        try:
            timestamp = base36_to_int(token.split("-")[0])
        except ValueError:
            return False
        expected = self._make_token_with_timestamp(user, timestamp, self.secret)
        fresh = self._num_seconds(self._now()) - timestamp <= self.timeout_seconds
        return constant_time_compare(expected, token) and fresh


setup_token_generator = PasswordLinkTokenGenerator(SETUP, settings.SETUP_TOKEN_TIMEOUT)  # 24 h
reset_token_generator = PasswordLinkTokenGenerator(RESET, settings.RESET_TOKEN_TIMEOUT)  # 1 h

GENERATORS = {SETUP: setup_token_generator, RESET: reset_token_generator}


def bump_nonce(user) -> None:
    """Invalidate every outstanding link for this user."""
    type(user).objects.filter(pk=user.pk).update(token_nonce=F("token_nonce") + 1)
    user.refresh_from_db(fields=["token_nonce"])


def make_password_link(user, purpose: str) -> str:
    """Full frontend URL for the set-password page. Call bump_nonce(user) first to revoke older links."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = GENERATORS[purpose].make_token(user)
    return f"{settings.FRONTEND_URL}/set-password/{uid}/{token}?purpose={purpose}"


def resolve_token(uidb64: str, token: str, purpose: str):
    """Return the user if the link is valid, else None."""
    from apps.accounts.models import User

    generator = GENERATORS.get(purpose)
    if generator is None:
        return None
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError, ValidationError):
        return None
    return user if generator.check_token(user, token) else None
