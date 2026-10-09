"""Audit log routes (S4). Mounted at /api/v1/admin/ — register 'audit-log'."""

from django.urls import path  # noqa: F401
from rest_framework.routers import SimpleRouter

router = SimpleRouter(trailing_slash=True)

urlpatterns: list = [*router.urls]
