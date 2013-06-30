from optparse import make_option
import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User

from xml.dom import minidom

from yarr import models

class Command(BaseCommand):
    help = 'Import subscriptions from an OPML file'
    
    option_list = BaseCommand.option_list + (
        make_option(
            '--purge',
            action='store_true',
            dest='purge',
            default=False,
            help='Purge current feeds for this user',
        ),
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
        except User.DoesNotExist, e:
            raise CommandError('User "%s" does not exist' % username)
        
        # Purge current entries
        if options['purge']:
            print "Purging feeds for %s..." % user
            models.Feed.objects.filter(user=user).delete()
        
        # Parse subscription
        print "Importing feeds..."
        xmldoc = minidom.parse(subscription_file)
        
        # Pull out feeds
        count = 0
        for node in xmldoc.getElementsByTagName('outline'):
            # If it doesn't have an xml url, it's not a feed
            xml_url = node.attributes.get('xmlUrl', None)
            if xml_url is None:
                continue
            xml_url = xml_url.value
            
            # Get other vars
            title = node.attributes.get('title', None)
            if title is None:
                title = xml_url
            else:
                title = title.value
            
            site_url = node.attributes.get('htmlUrl', None)
            if site_url is None:
                site_url = ''
            else:
                site_url = site_url.value
            
            # Add feed
            print "  %s" % title
            models.Feed.objects.create(
                title       = title,
                feed_url    = xml_url,
                site_url    = site_url,
                user        = user,
            )
            count += 1
            
        print "Imported %s feeds for %s" % (count, user)
        