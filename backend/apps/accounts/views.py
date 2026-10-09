from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import services
from apps.accounts.auth import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from apps.accounts.models import User
from apps.accounts.serializers import (
    ForgotPasswordSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    MeSerializer,
    MessageSerializer,
    SetPasswordSerializer,
    TokenSerializer,
    ValidateTokenResponseSerializer,
)
from common.exceptions import AppError
from common.ratelimit import rate_limited

FORGOT_MESSAGE = "If an account exists for that email, we've sent a reset link."


class PublicView(APIView):
    """No auth: a stale or broken cookie must never block login or password links."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []


class LoginView(PublicView):
    @extend_schema(request=LoginSerializer, responses=LoginResponseSerializer)
    @rate_limited(key="ip+email", rate="5/15m")
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = services.login(data.validated_data["email"], data.validated_data["password"])
        response = Response({"role": user.role, "redirect_to": services.home_route(user)})
        return set_auth_cookies(response, user)


class RefreshView(PublicView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if not raw:
            raise AppError("UNAUTHORIZED", "Please log in to continue.", 401)
        try:
            user = User.objects.get(pk=RefreshToken(raw)["user_id"], is_active=True)
        except (TokenError, User.DoesNotExist, KeyError):
            raise AppError("UNAUTHORIZED", "Your session has expired. Please log in again.", 401) from None
        return set_auth_cookies(Response(status=204), user)


class LogoutView(PublicView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        return clear_auth_cookies(Response(status=204))


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(services.me_payload(request.user)).data)


class ForgotPasswordView(PublicView):
    @extend_schema(request=ForgotPasswordSerializer, responses=MessageSerializer)
    @rate_limited(key="ip", rate="3/15m")
    def post(self, request):
        data = ForgotPasswordSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.request_password_reset(data.validated_data["email"])
        return Response({"message": FORGOT_MESSAGE})


class ValidateTokenView(PublicView):
    @extend_schema(request=TokenSerializer, responses=ValidateTokenResponseSerializer)
    def post(self, request):
        data = TokenSerializer(data=request.data)
        if not data.is_valid():
            return Response({"valid": False})
        return Response(services.validate_link(**data.validated_data))


class SetPasswordView(PublicView):
    @extend_schema(request=SetPasswordSerializer, responses=MessageSerializer)
    @rate_limited(key="ip", rate="10/15m")
    def post(self, request):
        data = SetPasswordSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        services.set_password(v["uid"], v["token"], v["purpose"], v["password"])
        return Response({"message": "Your password has been set. You can now sign in."})
