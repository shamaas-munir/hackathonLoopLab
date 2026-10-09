from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    message = "Admins only."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.role == "admin")


class IsStudent(BasePermission):
    message = "Students only."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and user.role == "student" and hasattr(user, "student")
        )
