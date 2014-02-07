"""
Yarr model managers
"""
import datetime
import time

from django.db import models

import bleach

from yarr import settings
from yarr.constants import ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED


###############################################################################
#                                                               Feed model

class FeedQuerySet(models.query.QuerySet):
    def active(self):
        "Filter to active feeds"
        return self.filter(is_active=True)
        
    def check(self, force=False, read=False, logfile=None):
        "Check active feeds for updates"
        for feed in self.active():
            feed.check(force, read, logfile)
    
    def update_count_unread(self):
        "Update the cached unread counts"
        for feed in self:
            feed.update_count_unread()
            feed.save()
    
    
class FeedManager(models.Manager):
    def active(self):
        "Active feeds"
        return self.get_query_set().active()
        
    def check(self, force=False, read=False, logfile=None):
        "Check all active feeds for updates"
        return self.get_query_set().check(force, read, logfile)
        
    def update_count_unread(self):
        "Update the cached unread counts"
        return self.get_query_set().update_count_unread()
        
    def get_query_set(self):
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
        
    def feeds(self):
        "Get feeds associated with entries"
        return models.loading.get_model('yarr', 'Feed').objects.filter(
            id__in=self.values_list('feed_id', flat=True).distinct(),
        )
        
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
        self.feeds().update_count_unread()

    
class EntryManager(models.Manager):
    def user(self, user):
        "Filter by user"
        return self.get_query_set().user(user)
    
    def read(self):
        "Get read entries"
        return self.get_query_set().read()
        
    def unread(self):
        "Get unread entries"
        return self.get_query_set().unread()
        
    def saved(self):
        "Get saved entries"
        return self.get_query_set().saved()
    
    def update_feed_unread(self):
        "Update feed read count cache"
        return self.get_query_set().update_feed_unread()
        
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
        
    def get_query_set(self):
        """
        Return an EntryQuerySet
        """
        return EntryQuerySet(self.model)
