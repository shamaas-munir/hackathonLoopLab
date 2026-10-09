"""Audit log routes (S4). Mounted at /api/v1/admin/."""

from rest_framework.routers import SimpleRouter

from apps.core.views import AuditLogViewSet

router = SimpleRouter(trailing_slash=True)
router.register("audit-log", AuditLogViewSet, basename="admin-audit-log")

urlpatterns: list = [*router.urls]
