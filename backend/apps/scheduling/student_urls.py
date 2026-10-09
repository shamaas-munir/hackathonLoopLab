"""Student courses + date sheet routes (S5). Mounted at /api/v1/me/."""

from django.urls import path  # noqa: F401
from rest_framework.routers import SimpleRouter

router = SimpleRouter(trailing_slash=True)

urlpatterns: list = [*router.urls]
