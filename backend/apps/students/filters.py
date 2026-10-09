import django_filters
from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX

from apps.students.models import CourseAssignment, Student
from apps.students.state import MAX_COURSES, MIN_COURSES


class StudentFilter(django_filters.FilterSet):
    """`assignment` relies on the `assignment_count` annotation added by the view's queryset."""

    assignment = django_filters.ChoiceFilter(
        choices=[("complete", "Complete"), ("incomplete", "Incomplete")], method="filter_assignment"
    )
    datesheet = django_filters.ChoiceFilter(
        choices=[("saved", "Saved"), ("not_saved", "Not saved")], method="filter_datesheet"
    )
    account = django_filters.ChoiceFilter(
        choices=[("active", "Active"), ("invited", "Invited")], method="filter_account"
    )

    class Meta:
        model = Student
        fields = ["program", "semester", "branch"]

    def filter_assignment(self, queryset, name, value):
        if value == "complete":
            return queryset.filter(assignment_count__gte=MIN_COURSES, assignment_count__lte=MAX_COURSES)
        return queryset.filter(assignment_count__lt=MIN_COURSES)

    def filter_datesheet(self, queryset, name, value):
        return queryset.filter(datesheet_saved_at__isnull=value != "saved")

    def filter_account(self, queryset, name, value):
        invited = queryset.filter(user__password__startswith=UNUSABLE_PASSWORD_PREFIX)
        return invited if value == "invited" else queryset.exclude(pk__in=invited.values("pk"))


class AssignmentFilter(django_filters.FilterSet):
    program = django_filters.UUIDFilter(field_name="student__program")

    class Meta:
        model = CourseAssignment
        fields = ["course", "student"]
