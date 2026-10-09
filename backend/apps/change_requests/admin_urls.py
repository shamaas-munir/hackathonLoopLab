"""Admin request review routes (S4). Mounted at /api/v1/admin/."""

from rest_framework.routers import SimpleRouter

from apps.change_requests.admin_views import AdminRequestViewSet

router = SimpleRouter(trailing_slash=True)
router.register("requests", AdminRequestViewSet, basename="admin-requests")

urlpatterns: list = [*router.urls]
