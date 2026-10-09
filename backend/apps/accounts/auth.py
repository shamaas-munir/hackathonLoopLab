"""JWT in httpOnly cookies.

The frontend proxies /api/* to Django, so cookies are same-origin. SameSite=Lax + JSON-only API
protects against CSRF; the access token is never readable by JavaScript (XSS-safe).
"""

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

ACCESS_COOKIE = "access"
REFRESH_COOKIE = "refresh"
ROLE_COOKIE = "role"  # not httpOnly: used only by the frontend to pick a layout; the API is the real guard


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw = request.COOKIES.get(ACCESS_COOKIE)
        if raw is None:
            header = self.get_header(request)
            if header is None:
                return None
            raw = self.get_raw_token(header)
            if raw is None:
                return None
        validated = self.get_validated_token(raw)
        return self.get_user(validated), validated


def _cookie_kwargs(httponly=True):
    return {
        "httponly": httponly,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": "/",
    }


def set_auth_cookies(response, user, refresh: RefreshToken | None = None):
    refresh = refresh or RefreshToken.for_user(user)
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        ACCESS_COOKIE,
        str(refresh.access_token),
        max_age=int(jwt["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        **_cookie_kwargs(),
    )
    response.set_cookie(
        REFRESH_COOKIE,
        str(refresh),
        max_age=int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        **_cookie_kwargs(),
    )
    response.set_cookie(
        ROLE_COOKIE,
        user.role,
        max_age=int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        **_cookie_kwargs(httponly=False),
    )
    return response


def clear_auth_cookies(response):
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, ROLE_COOKIE):
        response.delete_cookie(name, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
    return response
