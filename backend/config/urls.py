from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_request):
    return JsonResponse({"status": "ok"})


admin_api = [
    path("", include("apps.branches.urls")),
    path("", include("apps.courses.urls")),
    path("", include("apps.dashboard.urls")),
    path("", include("apps.students.urls")),
    path("", include("apps.scheduling.admin_urls")),
    path("", include("apps.change_requests.admin_urls")),
    path("", include("apps.core.urls")),
]

me_api = [
    path("", include("apps.students.me_urls")),
    path("", include("apps.scheduling.student_urls")),
    path("", include("apps.change_requests.student_urls")),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/health/", health),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/admin/", include(admin_api)),
    path("api/v1/me/", include(me_api)),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
