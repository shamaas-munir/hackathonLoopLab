import django_filters
from django.db import transaction
from django.db.models import Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce

from apps.branches.models import Branch
from apps.scheduling import slot_services
from apps.scheduling.admin_serializers import AdminSlotSerializer
from apps.scheduling.models import DatesheetSelection, ExamSlot
from common import audit
from common.models import Status
from common.time import now
from common.views import AdminModelViewSet


class SlotFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="start_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="start_at", lookup_expr="date__lte")
    upcoming = django_filters.BooleanFilter(method="filter_upcoming")

    class Meta:
        model = ExamSlot
        fields = ["course"]

    def filter_upcoming(self, queryset, _name, value):
        return queryset.filter(start_at__gt=now()) if value else queryset


class AdminSlotViewSet(AdminModelViewSet):
    serializer_class = AdminSlotSerializer
    filterset_class = SlotFilter
    search_fields = ["course__code", "course__title"]
    ordering_fields = ["start_at", "course__code", "chosen_count"]
    ordering = ["start_at", "course__code"]

    def get_queryset(self):
        chosen = (
            DatesheetSelection.objects.filter(slot=OuterRef("pk"))
            .order_by()
            .values("slot")
            .annotate(n=Count("pk"))
            .values("n")
        )
        return ExamSlot.objects.select_related("course").annotate(
            chosen_count=Coalesce(Subquery(chosen, output_field=IntegerField()), 0)
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["active_branches"] = Branch.objects.filter(status=Status.ACTIVE).count()
        return context

    def perform_destroy(self, instance):
        with transaction.atomic():
            audit.log_audit(self.request.user, audit.DELETE, instance, {"course": instance.course.code})
            slot_services.delete_slot(instance)
