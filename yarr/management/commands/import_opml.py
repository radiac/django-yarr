import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from yarr import models
from yarr.utils import import_opml


class Command(BaseCommand):
    help = "Import subscriptions from an OPML file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--purge",
            action="store_true",
            dest="purge",
            default=False,
            help="Purge current feeds for this user",
        )

    def handle(self, subscription_file, username, *args, **options):
        # Get subscriptions
        if not os.path.exists(subscription_file):
            raise CommandError(
                'Subscription file "%s" does not exist' % subscription_file
            )

        # Look up user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError('User "%s" does not exist' % username)

        # Purge current entries
        if options["purge"]:
            print(("Purging feeds for %s..." % user))
            models.Feed.objects.filter(user=user).delete()

        # Parse subscription
        print("Importing feeds...")
        new_count, old_count = import_opml(subscription_file, user, options["purge"])

        print(
            (
                "Imported %s new feeds and %s already existed for %s"
                % (new_count, old_count, user)
            )
        )
