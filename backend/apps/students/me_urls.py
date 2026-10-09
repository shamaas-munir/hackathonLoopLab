"""Student self-service routes: profile, branches, branch (S5). Mounted at /api/v1/me/."""

from django.urls import path

from apps.students.me_views import BranchListView, ProfileView, SelectBranchView

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="me-profile"),
    path("branches/", BranchListView.as_view(), name="me-branches"),
    path("branch/", SelectBranchView.as_view(), name="me-branch"),
]
