from django.apps import AppConfig
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save

ACTIVE_BRANCHES_CACHE_KEY = "active_branches"


def _clear_active_branches(**_kwargs):
    cache.delete(ACTIVE_BRANCHES_CACHE_KEY)


class BranchesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.branches"

    def ready(self):
        post_save.connect(_clear_active_branches, sender="branches.Branch")
        post_delete.connect(_clear_active_branches, sender="branches.Branch")
