from django.contrib import admin

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "is_active", "date_joined")
    list_filter = ("role", "is_active")
    search_fields = ("email",)
    exclude = ("password",)
