import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from apps.notifications.models import EmailOutbox, OutboxStatus

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5

SUBJECTS = {
    "account_setup": "Your ExamSlot portal account is ready: set your password",
    "password_reset": "Reset your ExamSlot password",
    "request_decision": "Update on your ExamSlot request",
    "datesheet_saved": "Your exam date sheet is saved",
}


def _send(row: EmailOutbox) -> None:
    context = {**row.context, "frontend_url": settings.FRONTEND_URL}
    subject = row.context.get("subject") or SUBJECTS.get(row.template, "ExamSlot notification")
    text = render_to_string(f"emails/{row.template}.txt", context)
    html = render_to_string(f"emails/{row.template}.html", context)
    message = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [row.to])
    message.attach_alternative(html, "text/html")
    message.send()


@shared_task
def send_outbox_email(outbox_id: str) -> None:
    with transaction.atomic():
        row = EmailOutbox.objects.select_for_update(skip_locked=True).filter(pk=outbox_id, status="pending").first()
        if row is None:
            return
        row.attempts += 1
        try:
            _send(row)
        except Exception as exc:  # noqa: BLE001 — record any provider failure and retry later
            logger.warning("Email %s failed: %s", row.pk, exc)
            row.last_error = str(exc)[:1000]
            if row.attempts >= MAX_ATTEMPTS:
                row.status = OutboxStatus.FAILED
        else:
            row.status = OutboxStatus.SENT
            row.sent_at = timezone.now()
        row.save(update_fields=["attempts", "last_error", "status", "sent_at"])


@shared_task
def relay_outbox() -> None:
    """Celery Beat safety net: retry anything still pending."""
    for pk in EmailOutbox.objects.filter(status="pending").values_list("pk", flat=True)[:100]:
        send_outbox_email.delay(str(pk))
