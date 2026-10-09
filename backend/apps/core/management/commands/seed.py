"""Demo data: 1 admin, 4 branches, 4 departments, 3 programs, 10 courses, ~25 slots, 5 students.

uv run python manage.py seed          # only seeds an empty database
uv run python manage.py seed --reset  # wipes ExamSlot data first, then seeds
"""

from datetime import date, time, timedelta

import environ
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.branches.models import Branch
from apps.change_requests.models import ChangeRequest
from apps.core.models import AuditLog
from apps.courses.models import Course, Department
from apps.notifications.models import EmailOutbox
from apps.scheduling.models import DatesheetSelection, ExamSlot, SlotSeat
from apps.scheduling.seats import reserve_seat
from apps.students.models import CourseAssignment, Program, Student
from common.time import combine, slot_range

env = environ.Env()

BRANCHES = [
    ("Lahore Campus", "LHR", "Lahore", "54-Lawrence Road, Lahore", "042-35761234", "active"),
    ("Islamabad Campus", "ISB", "Islamabad", "Plot 12, G-9/4, Islamabad", "051-2287654", "active"),
    ("Karachi Campus", "KHI", "Karachi", "ST-5, Block 7, Gulshan-e-Iqbal, Karachi", "021-34987654", "active"),
    ("Peshawar Campus", "PSH", "Peshawar", "University Road, Peshawar", "091-5701234", "inactive"),
]
DEPARTMENTS = [("Computer Science", "CS"), ("Mathematics", "MTH"), ("English", "ENG"), ("Physics", "PHY")]
PROGRAMS = [("BS Computer Science", "BSCS", 8), ("BS Software Engineering", "BSSE", 8), ("BBA", "BBA", 8)]
COURSES = [
    ("CS101", "Introduction to Computing", 3, "CS"),
    ("MTH101", "Calculus and Analytical Geometry", 3, "MTH"),
    ("ENG101", "English Comprehension", 3, "ENG"),
    ("PHY101", "Physics", 3, "PHY"),
    ("CS201", "Introduction to Programming", 4, "CS"),
    ("CS301", "Data Structures", 3, "CS"),
    ("MTH202", "Discrete Mathematics", 3, "MTH"),
    ("CS304", "Object Oriented Programming", 3, "CS"),
    ("ENG201", "Business and Technical English Writing", 2, "ENG"),
    ("CS403", "Database Management Systems", 3, "CS"),
]
STUDENTS = [
    # key, name, gender, program, semester, courses (indexes), branch, saved, pending request
    ("ali", "Ali Raza", "male", "BSCS", 1, [0, 1, 2, 3, 4], None, False, False),
    ("sara", "Sara Ahmed", "female", "BSCS", 1, [0, 1, 2, 3], "LHR", False, False),
    ("usman", "Muhammad Usman", "male", "BSSE", 3, [4, 5, 6, 7, 8, 9], "ISB", True, False),
    ("ayesha", "Ayesha Khan", "female", "BBA", 1, [0, 1, 2], None, False, False),
    ("bilal", "Bilal Hussain", "male", "BSCS", 3, [5, 6, 7, 8], "KHI", True, True),
]


class Command(BaseCommand):
    help = "Seed ExamSlot demo data."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing ExamSlot data first.")

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self._wipe()
        elif Branch.objects.exists():
            self.stdout.write(self.style.WARNING("Database already has data. Use --reset to rebuild the demo."))
            return

        admin_email = env("SEED_ADMIN_EMAIL", default="admin@examslot.app")
        User.objects.create_superuser(admin_email, env("SEED_ADMIN_PASSWORD", default="Admin@123"))

        branches = {
            code: Branch.objects.create(name=n, code=code, city=c, address=a, contact_number=p, status=s)
            for n, code, c, a, p, s in BRANCHES
        }
        departments = {code: Department.objects.create(name=n, code=code) for n, code in DEPARTMENTS}
        programs = {code: Program.objects.create(name=n, code=code, duration_semesters=d) for n, code, d in PROGRAMS}
        courses = [
            Course.objects.create(code=code, title=t, credit_hours=h, department=departments[d])
            for code, t, h, d in COURSES
        ]
        first_slots = self._slots(courses)
        self._students(courses, first_slots, branches, programs)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded: admin {admin_email}, {len(branches)} branches, {len(courses)} courses, "
                f"{ExamSlot.objects.count()} slots, {Student.objects.count()} students."
            )
        )

    def _wipe(self):
        for model in (
            DatesheetSelection,
            SlotSeat,
            ChangeRequest,
            CourseAssignment,
            ExamSlot,
            Student,
            Course,
            Department,
            Program,
            Branch,
            EmailOutbox,
            AuditLog,
        ):
            model.objects.all().delete()
        User.objects.all().delete()

    def _slots(self, courses):
        """Course i: day base+i 09:00–12:00 and day base+i+1 14:00–17:00.
        Odd courses also get day base+i-1 09:00–12:00, which overlaps course i-1 on purpose (conflict demo)."""
        base = timezone.localdate() + timedelta(days=14)
        first = []
        for i, course in enumerate(courses):
            day = base + timedelta(days=i)
            capacity = 2 if i == 0 else (30 if i in (2, 3) else None)
            first.append(self._slot(course, day, 9, capacity))
            self._slot(course, day + timedelta(days=1), 14, None)
            if i % 2 == 1:
                self._slot(course, day - timedelta(days=1), 9, None)
        return first

    @staticmethod
    def _slot(course, day: date, hour: int, capacity):
        start = combine(day, time(hour))
        return ExamSlot.objects.create(
            course=course, start_at=start, end_at=start + timedelta(hours=3), capacity_per_branch=capacity
        )

    def _students(self, courses, first_slots, branches, programs):
        password = env("SEED_STUDENT_PASSWORD", default="Student@123")
        now = timezone.now()
        for n, (key, name, gender, program, semester, idx, branch_code, saved, pending) in enumerate(STUDENTS, 1):
            user = User.objects.create_user(f"{key}@student.examslot.app", password, role=Role.STUDENT)
            branch = branches.get(branch_code) if branch_code else None
            student = Student.objects.create(
                user=user,
                full_name=name,
                phone=f"0300{1234560 + n}",
                cnic=f"35202-{4567890 + n}-{n % 10}",
                date_of_birth=date(2002, n, 10 + n),
                gender=gender,
                address=f"House {n * 7}, Street {n}, Lahore",
                guardian_name=f"{name.split()[-1]} Sr.",
                guardian_cnic=f"35202-{1234500 + n}-{(n + 3) % 10}",
                guardian_occupation=["Engineer", "Teacher", "Business", "Doctor", "Farmer"][n - 1],
                guardian_contact=f"0321{7654320 + n}",
                emergency_contact=f"0333{1112220 + n}",
                registration_no=f"VU-2024-{n:04d}",
                program=programs[program],
                semester=semester,
                session="2024-2028",
                previous_qualification="FSc Pre-Engineering",
                previous_institute="Government College Lahore",
                marks_or_cgpa=["912", "3.45", "3.10", "845", "2.95"][n - 1],
                branch=branch,
                branch_selected_at=now if branch else None,
            )
            for i in idx:
                CourseAssignment.objects.create(student=student, course=courses[i])
            if saved:
                for i in idx:
                    slot = first_slots[i]
                    reserve_seat(slot, branch)
                    DatesheetSelection.objects.create(
                        student=student,
                        course=courses[i],
                        slot=slot,
                        branch=branch,
                        during=slot_range(slot.start_at, slot.end_at),
                    )
                student.datesheet_saved_at = now
                student.save(update_fields=["datesheet_saved_at"])
            if pending:
                ChangeRequest.objects.create(
                    student=student,
                    type="change_datesheet",
                    reason="I have a family wedding on the date of my CS301 exam.",
                )
