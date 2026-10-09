"""Student courses + date sheet routes (S5). Mounted at /api/v1/me/."""

from django.urls import path

from apps.scheduling.student_views import MyCoursesView, MyDatesheetView

urlpatterns = [
    path("courses/", MyCoursesView.as_view(), name="me-courses"),
    path("datesheet/", MyDatesheetView.as_view(), name="me-datesheet"),
]
