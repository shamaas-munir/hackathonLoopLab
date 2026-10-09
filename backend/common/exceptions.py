"""Uniform API errors: every error body is {"error": {"code", "message", "field_errors"}}."""

import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError, RestrictedError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Business-rule failure raised by services. Rendered by custom_exception_handler."""

    def __init__(self, code: str, message: str, status: int = 400, field_errors: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.field_errors = field_errors or {}


def _body(code, message, field_errors=None):
    return {"error": {"code": code, "message": message, "field_errors": field_errors or {}}}


def _flatten(detail):
    """DRF error detail -> {field: "first message"}."""
    if isinstance(detail, dict):
        out = {}
        for key, value in detail.items():
            if isinstance(value, dict):
                for sub_key, sub_value in _flatten(value).items():
                    out[f"{key}.{sub_key}"] = sub_value
            elif isinstance(value, list) and value:
                first = value[0]
                out[key] = _flatten(first) if isinstance(first, dict) else str(first)
            else:
                out[key] = str(value)
        return out
    if isinstance(detail, list) and detail:
        return {"non_field_errors": str(detail[0])}
    return {"non_field_errors": str(detail)}


# Constraint name -> (field, message) so database errors read like validation errors.
CONSTRAINT_MESSAGES = {
    "accounts_user_email": ("email", "A user with this email already exists."),
    "unique_student_cnic": ("cnic", "A student with this CNIC already exists."),
    "unique_student_registration_no": ("registration_no", "This registration number already exists."),
    "unique_branch_code": ("code", "A branch with this code already exists."),
    "unique_course_code": ("code", "A course with this code already exists."),
    "unique_department_code": ("code", "A department with this code already exists."),
    "unique_program_code": ("code", "A program with this code already exists."),
    "unique_assignment": ("course", "This course is already assigned to the student."),
    "unique_slot_per_course_start": ("start_time", "This course already has a slot at that date and time."),
    "one_slot_per_course": ("selections", "Only one slot can be chosen per course."),
    "one_pending_request_per_type": ("type", "You already have a pending request of this type."),
}


def _integrity_response(exc: IntegrityError):
    text = str(exc)
    if "no_overlapping_exams" in text:
        return Response(
            _body("SLOT_CONFLICT", "Two of your exams overlap in time. Pick different slots."),
            status=status.HTTP_409_CONFLICT,
        )
    if "seat_booked_within_capacity" in text:
        return Response(_body("SLOT_FULL", "This slot is full at your branch."), status=status.HTTP_409_CONFLICT)
    for name, (field, message) in CONSTRAINT_MESSAGES.items():
        if name in text:
            return Response(_body("CONFLICT", message, {field: message}), status=status.HTTP_409_CONFLICT)
    logger.warning("Unmapped IntegrityError: %s", text)
    return Response(_body("CONFLICT", "This change conflicts with existing data."), status=status.HTTP_409_CONFLICT)


def custom_exception_handler(exc, context):
    if isinstance(exc, AppError):
        return Response(_body(exc.code, exc.message, exc.field_errors), status=exc.status)

    if isinstance(exc, (ProtectedError, RestrictedError)):
        return Response(
            _body("IN_USE", "This record is in use and can't be deleted. Mark it inactive instead."),
            status=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, IntegrityError):
        return _integrity_response(exc)

    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "error_dict") else {"non_field_errors": exc.messages}
        fields = _flatten(detail)
        return Response(
            _body("VALIDATION", next(iter(fields.values()), "Invalid input."), fields),
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    if isinstance(exc, Http404):
        exc = exceptions.NotFound()

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled error", exc_info=exc)
        return Response(
            _body("SERVER_ERROR", "Something went wrong. Please try again."),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, exceptions.ValidationError):
        fields = _flatten(exc.detail)
        message = fields.get("non_field_errors") or next(iter(fields.values()), "Invalid input.")
        response.data = _body("VALIDATION", message, fields)
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    elif isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        response.data = _body("UNAUTHORIZED", "Please log in to continue.")
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, exceptions.PermissionDenied):
        response.data = _body("FORBIDDEN", "You don't have permission to do this.")
    elif isinstance(exc, exceptions.NotFound):
        response.data = _body("NOT_FOUND", "Not found.")
    elif isinstance(exc, exceptions.Throttled):
        response.data = _body("RATE_LIMITED", "Too many attempts. Please wait and try again.")
    else:
        response.data = _body(getattr(exc, "default_code", "ERROR").upper(), str(getattr(exc, "detail", exc)))
    return response
