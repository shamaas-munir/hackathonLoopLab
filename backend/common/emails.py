"""Transactional outbox for emails (SYSTEM_DESIGN "Email and background jobs").

`queue_email` writes an EmailOutbox row inside the caller's transaction. After commit it is handed
to Celery (or sent inline when no Redis is configured). If sending fails, the Celery Beat relay retries.
"""

from django.db import transaction


def queue_email(to: str, template: str, context: dict) -> None:
    from apps.notifications.models import EmailOutbox
    from apps.notifications.tasks import send_outbox_email

    row = EmailOutbox.objects.create(to=to, template=template, context=context)
    transaction.on_commit(lambda: send_outbox_email.delay(str(row.pk)))
