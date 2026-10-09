"""Seat accounting per slot per branch (bonus BN-1, rule R22).

Postgres is the source of truth: reserving is one conditional UPDATE guarded by a CHECK constraint,
so two students can never take the last seat at the same time. Call inside transaction.atomic().
"""

from django.db.models import F, Q

from apps.scheduling.models import SlotSeat
from common.exceptions import AppError


def _seat(slot, branch) -> SlotSeat:
    seat, _ = SlotSeat.objects.get_or_create(slot=slot, branch=branch, defaults={"capacity": slot.capacity_per_branch})
    return seat


def seats_left(slot, branch) -> int | None:
    """Remaining seats, or None when the slot is unlimited."""
    if slot.capacity_per_branch is None:
        return None
    seat = SlotSeat.objects.filter(slot=slot, branch=branch).only("booked", "capacity").first()
    booked = seat.booked if seat else 0
    capacity = seat.capacity if seat and seat.capacity is not None else slot.capacity_per_branch
    return max(capacity - booked, 0)


def reserve_seat(slot, branch) -> None:
    seat = _seat(slot, branch)
    updated = (
        SlotSeat.objects.filter(pk=seat.pk)
        .filter(Q(capacity__isnull=True) | Q(booked__lt=F("capacity")))
        .update(booked=F("booked") + 1)
    )
    if not updated:
        raise AppError("SLOT_FULL", f"The slot for {slot.course.code} is full at your branch. Pick another time.", 409)


def release_seat(slot, branch) -> None:
    SlotSeat.objects.filter(slot=slot, branch=branch, booked__gt=0).update(booked=F("booked") - 1)
