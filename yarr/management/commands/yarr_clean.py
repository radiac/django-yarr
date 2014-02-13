from optparse import make_option

from django.conf import settings
from django.core.management.base import BaseCommand

from yarr import models
from yarr.decorators import with_socket_timeout


class Command(BaseCommand):
    help = 'Yarr cleaning tool'
    option_list = BaseCommand.option_list + (
        make_option(
            '--delete_read',
            action='store_true',
            dest='delete_read',
            default=False,
            help='Delete all read (unsaved) entries',
        ),
        make_option(
            '--update_cache',
            action='store_true',
            dest='update_cache',
            default=False,
            help='Update cache values',
        ),
    )
    
    @with_socket_timeout
    def handle(self, *args, **options):
        # Delete all read entries - useful for upgrades to 0.3.12
        if options['delete_read']:
            feeds = models.Feed.objects.filter(is_active=False)
            for feed in feeds:
                feed.entries.read().delete()
                feed.save()
        
        # Update feed unread and total counts
        if options['update_cache']:
            models.Feed.objects.update_count_unread().update_count_total()
        