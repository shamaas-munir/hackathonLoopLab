import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.postgres.indexes import GinIndex
from django.db import models


class Role(models.TextChoices):
    ADMIN = "admin", "Admin"
    STUDENT = "student", "Student"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()  # students get a password only through the setup link
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.update(role=Role.ADMIN, is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Login account. Profile data for students lives in students.Student (1–1)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)  # always stored lower-case
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    # Bumped whenever a password link is issued or used, so older links stop working (D11).
    token_nonce = models.PositiveIntegerField(default=0)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        indexes = [
            models.Index(fields=["role", "is_active"], name="user_role_active_idx"),
            GinIndex(fields=["email"], name="user_email_trgm", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self):
        return self.email

    @property
    def is_admin(self):
        return self.role == Role.ADMIN
