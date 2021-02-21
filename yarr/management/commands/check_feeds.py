from django.conf import settings
from django.core.management.base import BaseCommand

from yarr import models
from yarr.decorators import with_socket_timeout


# Supress feedparser's DeprecationWarning in production environments - we don't
# care about the changes to updated and published, we're already doing it right
if not settings.DEBUG:
    import warnings

    warnings.filterwarnings("ignore", category=DeprecationWarning)


class Command(BaseCommand):
    help = "Check feeds for updates"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            dest="force",
            default=False,
            help="Force all feeds to update",
        )
        parser.add_argument(
            "--read",
            action="store_true",
            dest="read",
            default=False,
            help="Any new items will be marked as read; useful when importing",
        )
        parser.add_argument(
            "--purge",
            action="store_true",
            dest="purge",
            default=False,
            help="Purge current entries and reset feed counters",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            dest="verbose",
            default=False,
            help="Print information to the console",
        )
        parser.add_argument("--url", dest="url", help="Specify the URL to update")

    @with_socket_timeout
    def handle(self, *args, **options):
        # Apply url filter
        entries = models.Entry.objects.all()
        feeds = models.Feed.objects.all()
        if options["url"]:
            feeds = feeds.filter(feed_url=options["url"])
            if feeds.count() == 0:
                raise ValueError("Specified URL must be a known feed")
            entries = entries.filter(feed__in=feeds)

        # Purge current entries
        if options["purge"]:
            entries.delete()
            feeds.update(last_updated=None, last_checked=None, next_check=None)

        # Check feeds for updates
        feeds.check_feed(
            force=options["force"],
            read=options["read"],
            logfile=self.stdout if options["verbose"] else None,
        )
