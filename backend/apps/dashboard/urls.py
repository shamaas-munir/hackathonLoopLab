"""Admin dashboard route (S2). Mounted at /api/v1/admin/."""

from django.urls import path

from .views import DashboardView

urlpatterns = [path("dashboard/", DashboardView.as_view(), name="admin-dashboard")]
