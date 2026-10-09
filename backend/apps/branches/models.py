from django.contrib.postgres.indexes import GinIndex
from django.db import models

from common.models import Status, TimeStampedModel


class Branch(TimeStampedModel):
    """A campus where students can sit their exams."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10)
    city = models.CharField(max_length=60)
    address = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=20)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["code"], name="unique_branch_code")]
        indexes = [
            models.Index(fields=["status", "name"], name="branch_status_name_idx"),
            GinIndex(fields=["name"], name="branch_name_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["city"], name="branch_city_trgm", opclasses=["gin_trgm_ops"]),
        ]
        verbose_name_plural = "branches"

    def __str__(self):
        return f"{self.name} ({self.code})"
