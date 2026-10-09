"""Transactional outbox for emails (SYSTEM_DESIGN "Email and background jobs").

`queue_email` writes an EmailOutbox row inside the caller's transaction. After commit the email is sent
off the request path: by a Celery worker when a broker is configured, otherwise on a background thread.
A slow or unreachable mail server therefore never delays the API response; failures stay in the outbox
and are retried by the relay task.
"""

import threading

from django.conf import settings
from django.db import connection, transaction


def _send_in_background(outbox_id: str) -> None:
    from apps.notifications.tasks import send_outbox_email

    def run():
        try:
            send_outbox_email(outbox_id)
        finally:
            connection.close()  # this thread opened its own DB connection

    threading.Thread(target=run, daemon=True).start()


def queue_email(to: str, template: str, context: dict) -> None:
    from apps.notifications.models import EmailOutbox
    from apps.notifications.tasks import send_outbox_email

    row = EmailOutbox.objects.create(to=to, template=template, context=context)
    if not settings.CELERY_TASK_ALWAYS_EAGER:
        transaction.on_commit(lambda: send_outbox_email.delay(str(row.pk)))
    elif settings.EMAIL_SEND_IN_BACKGROUND:
        transaction.on_commit(lambda: _send_in_background(str(row.pk)))
    else:  # tests: send inline so assertions can read mail.outbox
        transaction.on_commit(lambda: send_outbox_email(str(row.pk)))
