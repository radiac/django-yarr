from optparse import make_option

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
    help = 'Check feeds for updates'
    option_list = BaseCommand.option_list + (
        make_option(
            '--force',
            action='store_true',
            dest='force',
            default=False,
            help='Force updates even when not due',
        ),
        make_option(
            '--read',
            action='store_true',
            dest='read',
            default=False,
            help='Any new items will be marked as read; useful when importing',
        ),
        make_option(
            '--purge',
            action='store_true',
            dest='purge',
            default=False,
            help='Purge current entries and reset feed counters',
        ),
        make_option(
            '--verbose',
            action='store_true',
            dest='verbose',
            default=False,
            help='Print information to the console',
        ),
    )
    
    @with_socket_timeout
    def handle(self, *args, **options):
        # Purge current entries
        if options['purge']:
            models.Entry.objects.all().delete()
            models.Feed.objects.all().update(
                last_updated=None,
                last_checked=None,
                next_check=None,
            )
        
        # Check all feeds for updates
        models.Feed.objects.check(
            force=options['force'],
            read=options['read'],
            logfile=self.stdout if options['verbose'] else None,
        )
