"""Django Admin as a back-office for the demo; the real Admin Panel is the Next.js UI."""

from django.contrib import admin

from apps.branches.models import Branch
from apps.change_requests.models import ChangeRequest
from apps.core.models import AuditLog
from apps.courses.models import Course, Department
from apps.notifications.models import EmailOutbox
from apps.scheduling.models import DatesheetSelection, ExamSlot, SlotSeat
from apps.students.models import CourseAssignment, Program, Student

for model in (
    Branch,
    Department,
    Course,
    Program,
    Student,
    CourseAssignment,
    ExamSlot,
    SlotSeat,
    DatesheetSelection,
    ChangeRequest,
    EmailOutbox,
    AuditLog,
):
    admin.site.register(model)
