"""Extra demo data on top of `seed`: 20 more students in mixed states plus requests in every status.

    uv run python manage.py seed_mock

Safe to run more than once: students are keyed by registration number and skipped if they exist.
"""

import random

import environ
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.branches.models import Branch
from apps.change_requests.models import ChangeRequest
from apps.courses.models import Course
from apps.scheduling.models import DatesheetSelection, ExamSlot
from apps.scheduling.seats import reserve_seat
from apps.students.models import CourseAssignment, Program, Student
from common.time import overlaps, slot_range

env = environ.Env()

FIRST = [
    "Hamza",
    "Fatima",
    "Zainab",
    "Ahmed",
    "Hira",
    "Omar",
    "Maryam",
    "Hassan",
    "Iqra",
    "Saad",
    "Amna",
    "Talha",
    "Mahnoor",
    "Usama",
    "Noor",
    "Daniyal",
    "Areeba",
    "Fahad",
    "Sana",
    "Haris",
]
LAST = ["Malik", "Sheikh", "Qureshi", "Butt", "Chaudhry", "Siddiqui", "Abbasi", "Mirza", "Javed", "Iqbal"]
CITIES = ["Lahore", "Islamabad", "Karachi", "Rawalpindi", "Faisalabad", "Multan"]
REASONS = {
    "change_branch": ["My family moved to another city.", "The new campus is much closer to my home."],
    "change_datesheet": ["Two of my exams fall on a family wedding day.", "I have a medical appointment on that date."],
}


class Command(BaseCommand):
    help = "Add 20 extra demo students with assignments, saved date sheets and requests."

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(2026)  # noqa: S311 (deterministic demo data, not security)
        branches = list(Branch.objects.filter(status="active"))
        programs = list(Program.objects.all())
        # Courses 2..9 by code order: avoid CS101, whose first slot has only 2 seats.
        courses = list(Course.objects.order_by("created_at"))[1:]
        if not branches or len(courses) < 6:
            self.stderr.write("Run `manage.py seed` first.")
            return

        upcoming = {
            c.pk: list(ExamSlot.objects.filter(course=c, start_at__gt=timezone.now()).order_by("start_at"))
            for c in courses
        }
        password = env("SEED_STUDENT_PASSWORD", default="Student@123")
        created = 0
        for n in range(20):
            reg_no = f"VU-2025-{n + 1:04d}"
            if Student.objects.filter(registration_no=reg_no).exists():
                continue
            name = f"{FIRST[n]} {LAST[n % len(LAST)]}"
            email = f"{FIRST[n].lower()}.{LAST[n % len(LAST)].lower()}{n + 1}@student.examslot.app"
            user = User.objects.create_user(email, password, role=Role.STUDENT)
            state = n % 4  # 0: no branch, 1: branch only, 2: saved, 3: saved + request
            branch = None if state == 0 else branches[n % len(branches)]
            student = Student.objects.create(
                user=user,
                full_name=name,
                phone=f"0301{2000000 + n * 137:07d}",
                cnic=f"3520{n % 10}-{3000000 + n * 911:07d}-{n % 10}",
                date_of_birth=timezone.datetime(2001 + n % 5, 1 + n % 12, 1 + n % 27).date(),
                gender="female" if n % 2 else "male",
                address=f"House {n + 10}, Block {chr(65 + n % 6)}, {CITIES[n % 6]}",
                guardian_name=f"{LAST[n % len(LAST)]} Sahib",
                guardian_cnic=f"3520{n % 10}-{4000000 + n * 733:07d}-{(n + 1) % 10}",
                guardian_occupation=rng.choice(["Teacher", "Engineer", "Shopkeeper", "Doctor", "Accountant"]),
                guardian_contact=f"0322{5000000 + n * 211:07d}",
                emergency_contact=f"0333{6000000 + n * 97:07d}",
                registration_no=reg_no,
                program=programs[n % len(programs)],
                semester=1 + n % 8,
                session="2025-2029",
                previous_qualification=rng.choice(["FSc Pre-Engineering", "ICS", "A Levels", "FA"]),
                previous_institute=rng.choice(["Punjab College", "Govt College", "Beaconhouse", "KIPS College"]),
                marks_or_cgpa=rng.choice(["845", "910", "3.20", "3.65", "780"]),
                branch=branch,
                branch_selected_at=timezone.now() if branch else None,
            )
            picked = rng.sample(courses, 3 if n == 5 else 4 + n % 3)  # one student stays incomplete
            CourseAssignment.objects.bulk_create(CourseAssignment(student=student, course=c) for c in picked)

            if state >= 2 and len(picked) >= 4:
                chosen = []
                for course in picked:  # earliest slot that doesn't clash with the ones already chosen
                    slot = next(
                        x
                        for x in upcoming[course.pk]
                        if not any(overlaps(x.start_at, x.end_at, y.start_at, y.end_at) for y in chosen)
                    )
                    chosen.append(slot)
                    reserve_seat(slot, branch)
                    DatesheetSelection.objects.create(
                        student=student,
                        course=course,
                        slot=slot,
                        branch=branch,
                        during=slot_range(slot.start_at, slot.end_at),
                    )
                student.datesheet_saved_at = timezone.now()
                student.save(update_fields=["datesheet_saved_at"])
                if state == 3:
                    kind = "change_datesheet" if n % 2 else "change_branch"
                    status = ["pending", "approved", "rejected"][n % 3]
                    ChangeRequest.objects.create(
                        student=student,
                        type=kind,
                        reason=rng.choice(REASONS[kind]),
                        status=status,
                        admin_remark="" if status == "pending" else "Reviewed by the examination office.",
                        reviewed_at=None if status == "pending" else timezone.now(),
                    )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Added {created} demo students. Password: {password}"))
