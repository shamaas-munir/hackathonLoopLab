from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import services
from apps.accounts.auth import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from apps.accounts.models import User
from apps.accounts.serializers import LoginResponseSerializer, LoginSerializer, MeSerializer
from common.exceptions import AppError
from common.ratelimit import rate_limited


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    @extend_schema(request=LoginSerializer, responses=LoginResponseSerializer)
    @rate_limited(key="ip+email", rate="5/15m")
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = services.login(data.validated_data["email"], data.validated_data["password"])
        response = Response({"role": user.role, "redirect_to": services.home_route(user)})
        return set_auth_cookies(response, user)


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

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


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        return clear_auth_cookies(Response(status=204))


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(services.me_payload(request.user)).data)
