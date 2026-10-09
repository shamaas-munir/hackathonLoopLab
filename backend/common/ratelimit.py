"""Tiny cache-backed rate limiter (Redis in production, LocMem in development)."""

import functools
import hashlib
import re

from django.core.cache import cache

from common.exceptions import AppError

_UNITS = {"s": 1, "m": 60, "h": 3600}


def _parse(rate: str) -> tuple[int, int]:
    count, window = rate.split("/")
    match = re.fullmatch(r"(\d*)([smh])", window)
    if not match:
        raise ValueError(f"Bad rate: {rate}")
    amount = int(match.group(1) or 1)
    return int(count), amount * _UNITS[match.group(2)]


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def rate_limited(key: str = "ip", rate: str = "5/15m"):
    """Decorator for DRF view methods: `@rate_limited(key="ip+email", rate="5/15m")`."""
    limit, window = _parse(rate)

    def decorator(view_method):
        @functools.wraps(view_method)
        def wrapper(self, request, *args, **kwargs):
            parts = [view_method.__qualname__, _client_ip(request)]
            if key == "ip+email":
                parts.append(str(request.data.get("email", "")).strip().lower())
            digest = hashlib.sha256("|".join(parts).encode()).hexdigest()
            cache_key = f"rl:{digest}"
            cache.add(cache_key, 0, timeout=window)
            try:
                hits = cache.incr(cache_key)
            except ValueError:
                cache.set(cache_key, 1, timeout=window)
                hits = 1
            if hits > limit:
                raise AppError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429)
            return view_method(self, request, *args, **kwargs)

        return wrapper

    return decorator
