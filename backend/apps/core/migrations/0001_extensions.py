from django.contrib.postgres.operations import BtreeGistExtension, TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Postgres extensions: btree_gist (exclusion constraint) and pg_trgm (fast icontains search)."""

    initial = True
    dependencies: list = []
    operations = [BtreeGistExtension(), TrigramExtension()]
