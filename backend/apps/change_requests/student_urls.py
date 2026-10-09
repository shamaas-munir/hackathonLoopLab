"""Student request routes (S5). Mounted at /api/v1/me/ — 'requests/'."""

from django.urls import path

from apps.change_requests.student_views import MyRequestsView

urlpatterns = [path("requests/", MyRequestsView.as_view(), name="me-requests")]
