"""Admin course + department routes (S2). Mounted at /api/v1/admin/."""

from rest_framework.routers import SimpleRouter

from .views import CourseViewSet, DepartmentViewSet

router = SimpleRouter(trailing_slash=True)
router.register("courses", CourseViewSet, basename="course")
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = router.urls
