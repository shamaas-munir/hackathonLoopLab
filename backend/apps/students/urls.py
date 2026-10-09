"""Admin student, program and assignment routes (S3). Mounted at /api/v1/admin/."""

from rest_framework.routers import SimpleRouter

from apps.students.views import AssignmentViewSet, ProgramViewSet, StudentViewSet

router = SimpleRouter(trailing_slash=True)
router.register("students", StudentViewSet, basename="admin-students")
router.register("programs", ProgramViewSet, basename="admin-programs")
router.register("assignments", AssignmentViewSet, basename="admin-assignments")

urlpatterns: list = [*router.urls]
