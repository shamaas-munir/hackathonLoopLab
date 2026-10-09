"""Shared pytest fixtures. Every session builds its tests on these."""

from datetime import date, time, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.branches.models import Branch
from apps.courses.models import Course, Department
from apps.scheduling.models import ExamSlot
from apps.students.models import CourseAssignment, Program, Student
from common.time import combine

PASSWORD = "Passw0rd!x"


@pytest.fixture(autouse=True)
def _fast_hashing_and_console_email(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    settings.AUTH_COOKIE_SECURE = False


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user("admin@test.local", PASSWORD, role=Role.ADMIN)


@pytest.fixture
def admin_api(admin_user):
    client = APIClient()
    client.force_authenticate(admin_user)
    return client


@pytest.fixture
def department(db):
    return Department.objects.create(name="Computer Science", code="CS")


@pytest.fixture
def program(db):
    return Program.objects.create(name="BS Computer Science", code="BSCS")


@pytest.fixture
def branch(db):
    return Branch.objects.create(
        name="Lahore Campus", code="LHR", city="Lahore", address="1 Mall Road", contact_number="042-1234567"
    )


@pytest.fixture
def make_course(department):
    counter = {"n": 0}

    def _make(**kwargs):
        counter["n"] += 1
        defaults = {
            "code": f"TC{100 + counter['n']}",
            "title": f"Test Course {counter['n']}",
            "credit_hours": 3,
            "department": department,
        }
        defaults.update(kwargs)
        return Course.objects.create(**defaults)

    return _make


@pytest.fixture
def make_slot():
    def _make(course, days_ahead=10, hour=9, hours=3, capacity=None):
        start = combine(timezone.localdate() + timedelta(days=days_ahead), time(hour=hour))
        return ExamSlot.objects.create(
            course=course, start_at=start, end_at=start + timedelta(hours=hours), capacity_per_branch=capacity
        )

    return _make


@pytest.fixture
def make_student(program):
    counter = {"n": 0}

    def _make(courses=(), branch=None, **kwargs):
        counter["n"] += 1
        n = counter["n"]
        user = User.objects.create_user(f"student{n}@test.local", PASSWORD, role=Role.STUDENT)
        defaults = {
            "user": user,
            "full_name": f"Student {n}",
            "phone": "03001234567",
            "cnic": f"35202-{1000000 + n}-1",
            "date_of_birth": date(2003, 1, 1),
            "gender": "male",
            "address": "Street 1, Lahore",
            "guardian_name": "Guardian",
            "guardian_cnic": f"35202-{2000000 + n}-1",
            "guardian_occupation": "Teacher",
            "guardian_contact": "03007654321",
            "emergency_contact": "03007654321",
            "registration_no": f"VU-TEST-{n:04d}",
            "program": program,
            "semester": 3,
            "session": "2024-2028",
            "previous_qualification": "FSc",
            "previous_institute": "Govt College",
            "marks_or_cgpa": "3.20",
            "branch": branch,
        }
        defaults.update(kwargs)
        student = Student.objects.create(**defaults)
        for course in courses:
            CourseAssignment.objects.create(student=student, course=course)
        return student

    return _make


@pytest.fixture
def student_api():
    def _client(student):
        client = APIClient()
        client.force_authenticate(student.user)
        return client

    return _client
