"""Admin request review routes (S4). Mounted at /api/v1/admin/ — register 'requests'."""

from django.urls import path  # noqa: F401
from rest_framework.routers import SimpleRouter

router = SimpleRouter(trailing_slash=True)

urlpatterns: list = [*router.urls]
