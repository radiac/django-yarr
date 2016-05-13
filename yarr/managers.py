"""
Yarr model managers
"""
import datetime
import time

from django.db import connection, models, transaction
from django.db.models.loading import get_model

import bleach

from yarr import settings
from yarr.constants import ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED


###############################################################################
#                                                               Feed model

class FeedQuerySet(models.query.QuerySet):
    def active(self):
        "Filter to active feeds"
        return self.filter(is_active=True)
        
    def check_feed(self, force=False, read=False, logfile=None):
        "Check active feeds for updates"
        for feed in self.active():
            feed.check_feed(force, read, logfile)
        
        # Update the total and unread counts
        self.update_count_unread()
        self.update_count_total()
        
        return self
    
    def _do_update(self, extra):
        "Perform the update for update_count_total and update_count_unread"
        # Get IDs for current queries
        ids = self.values_list('id', flat=True)
        
        # If no IDs, no sense trying to do anything
        if not ids:
            return self
        
        # Prepare query options
        # IDs and states should only ever be ints, but force them to
        # ints to be sure we don't introduce injection vulns
        opts = {
            'feed':     get_model('yarr', 'Feed')._meta.db_table,
            'entry':    get_model('yarr', 'Entry')._meta.db_table,
            'ids':      ','.join([str(int(id)) for id in ids]),
            
            # Fields which should be set in extra
            'field':    '',
            'where':    '',
        }
        opts.update(extra)
        
        # Uses raw query so we can update in a single call to avoid race condition
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE %(feed)s
                SET %(field)s=COALESCE(
                    (
                        SELECT COUNT(1)
                            FROM %(entry)s
                            WHERE %(feed)s.id=feed_id%(where)s
                            GROUP BY feed_id
                    ), 0
                )
                WHERE id IN (%(ids)s)
            """ % opts
        )
        
        # Ensure changes are committed in Django 1.5 or earlier
        #transaction.commit_unless_managed()
        
        return self
    
    def update_count_total(self):
        "Update the cached total counts"
        return self._do_update({
            'field':    'count_total',
        })
        
    def update_count_unread(self):
        "Update the cached unread counts"
        return self._do_update({
            'field':    'count_unread',
            'where':    ' AND state=%s' % ENTRY_UNREAD,
        })
    
    def count_unread(self):
        "Get a dict of unread counts, with feed pks as keys"
        return dict(self.values_list('pk', 'count_unread'))
    
    
class FeedManager(models.Manager):
    def active(self):
        "Active feeds"
        return self.get_queryset().active()
        
    def check_feed(self, force=False, read=False, logfile=None):
        "Check all active feeds for updates"
        return self.get_queryset().check_feed(force, read, logfile)
        
    def update_count_total(self):
        "Update the cached total counts"
        return self.get_queryset().update_count_total()
    
    def update_count_unread(self):
        "Update the cached unread counts"
        return self.get_queryset().update_count_unread()
    
    def count_unread(self):
        "Get a dict of unread counts, with feed pks as keys"
        return self.get_queryset().count_unread()
        
    def get_queryset(self):
        "Return a FeedQuerySet"
        return FeedQuerySet(self.model)



###############################################################################
#                                                               Entry model

class EntryQuerySet(models.query.QuerySet):
    def user(self, user):
        "Filter by user"
        return self.filter(feed__user=user)
        
    def read(self):
        "Filter to read entries"
        return self.filter(state=ENTRY_READ)
        
    def unread(self):
        "Filter to unread entries"
        return self.filter(state=ENTRY_UNREAD)
        
    def saved(self):
        "Filter to saved entries"
        return self.filter(state=ENTRY_SAVED)
    
    def set_state(self, state, count_unread=False):
        """
        Set a new state for these entries
        If count_unread=True, returns a dict of the new unread count for the
        affected feeds, {feed_pk: unread_count, ...}; if False, returns nothing
        """
        # Get list of feed pks before the update changes this queryset
        feed_pks = list(self.feeds().values_list('pk', flat=True))
        
        # Update the state
        self.update(state=state)
        
        # Look up affected feeds
        feeds = get_model('yarr', 'Feed').objects.filter(
            pk__in=feed_pks
        )
        
        # Update the unread counts for affected feeds
        feeds.update_count_unread()
        if count_unread:
            return feeds.count_unread()
        
    def feeds(self):
        "Get feeds associated with entries"
        return get_model('yarr', 'Feed').objects.filter(
            entries__in=self
        ).distinct()
        
    def set_expiry(self):
        "Ensure selected entries are set to expire"
        return self.filter(
            expires__isnull=True
        ).update(
            expires=datetime.datetime.now() + datetime.timedelta(
                days=settings.ITEM_EXPIRY,
            )
        )
    
    def clear_expiry(self):
        "Ensure selected entries will not expire"
        return self.exclude(
            expires__isnull=True
        ).update(expires=None)
        
    def update_feed_unread(self):
        "Update feed read count cache"
        return self.feeds().update_count_unread()

    
class EntryManager(models.Manager):
    def user(self, user):
        "Filter by user"
        return self.get_queryset().user(user)
    
    def read(self):
        "Get read entries"
        return self.get_queryset().read()
        
    def unread(self):
        "Get unread entries"
        return self.get_queryset().unread()
        
    def saved(self):
        "Get saved entries"
        return self.get_queryset().saved()
        
    def set_state(self, state):
        "Set a new state for these entries, and update unread count"
        return self.get_queryset().set_state(state)
    
    def update_feed_unread(self):
        "Update feed read count cache"
        return self.get_queryset().update_feed_unread()
        
    def from_feedparser(self, raw):
        """
        Create an Entry object from a raw feedparser entry
        
        Arguments:
            raw         The raw feedparser entry
        
        Returns:
            entry       An Entry instance (not saved)
        
        # ++ TODO: tags
        Any tags will be stored on _tags, to be moved to tags field after save
        
        The content field must be sanitised HTML of the entry's content, or
        failing that its sanitised summary or description.
        
        The date field should use the entry's updated date, then its published
        date, then its created date. If none of those are present, it will fall
        back to the current datetime when it is first saved.
        
        The guid is either the guid according to the feed, or the entry link.
    
        Currently ignoring the following feedparser attributes:
            author_detail
            contributors
            created
            enclosures
            expired
            license
            links
            publisher
            source
            summary_detail
            title_detail
            vcard
            xfn
        """
        # Create a new entry
        entry = self.model()
        
        # Get the title and content
        entry.title = raw.get('title', '')
        content = raw.get('content', [{'value': ''}])[0]['value']
        if not content:
            content = raw.get('description', '')
        
        # Sanitise the content
        entry.content = bleach.clean(
            content,
            tags=settings.ALLOWED_TAGS,
            attributes=settings.ALLOWED_ATTRIBUTES,
            styles=settings.ALLOWED_STYLES,
            strip=True,
        )
        
        # Order: updated, published, created
        # If not provided, needs to be None for update comparison
        # Will default to current time when saved
        date = raw.get(
            'updated_parsed', raw.get(
                'published_parsed', raw.get(
                    'created_parsed', None
                )
            )
        )
        if date is not None:
            entry.date = datetime.datetime.fromtimestamp(
                time.mktime(date)
            )
        
        entry.url = raw.get('link', '')
        entry.guid = raw.get('guid', entry.url)
        
        entry.author = raw.get('author', '')
        entry.comments_url = raw.get('comments', '')
        
        # ++ TODO: tags
        """
        tags = raw.get('tags', None)
        if tags is not None:
            entry._tags = tags
        """
        
        return entry
        
    def get_queryset(self):
        """
        Return an EntryQuerySet
        """
        return EntryQuerySet(self.model)
