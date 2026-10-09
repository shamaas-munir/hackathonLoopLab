"""Admin exam slot routes (S4). Mounted at /api/v1/admin/."""

from rest_framework.routers import SimpleRouter

from apps.scheduling.admin_views import AdminSlotViewSet

router = SimpleRouter(trailing_slash=True)
router.register("slots", AdminSlotViewSet, basename="admin-slots")

urlpatterns: list = [*router.urls]
