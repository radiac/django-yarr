"""
Yarr models
"""

import datetime
import time
import urllib2

from django.core.validators import URLValidator
from django.db import models

import feedparser
# ++ TODO: tags

from yarr import settings, managers
from yarr.constants import ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED


###############################################################################
#                                                               Setup

# Disable feedparser's sanitizer - FeedManager will be using bleach instead
feedparser.SANITIZE_HTML = 0

class NullFile(object):
    """Fake file object for disabling logging in Feed.check"""
    def write(self, str):
        pass
nullfile = NullFile()


###############################################################################
#                                                               Exceptions

class FeedError(Exception):
    """
    An error occurred when fetching the feed
    
    If it was parsed despite the error, the feed and entries will be available:
        e.feed      None if not parsed
        e.entries   Empty list if not parsed
    """
    def __init__(self, *args, **kwargs):
        self.feed = kwargs.pop('feed', None)
        self.entries = kwargs.pop('entries', [])
        super(FeedError, self).__init__(*args, **kwargs)

class InactiveFeedError(FeedError):
    pass
    
class EntryError(Exception):
    """
    An error occurred when processing an entry
    """
    pass



###############################################################################
#                                                               Feed model

class Feed(models.Model):
    """
    A feed definition
    
    The last_updated field is either the updated or published date of the feed,
    or if neither are set, the feed parser's best guess.
    
    Currently ignoring the following feedparser attributes:
        author
        author_detail
        cloud
        contributors
        docs
        errorreportsto
        generator
        generator_detail
        icon
        id
        image
        info
        info_detail
        language
        license
        links
        logo
        publisher
        rights
        subtitle
        tags
        textinput
        title
        ttl
    """
    # Compulsory data fields
    title = models.TextField(help_text="Published title of the feed")
    feed_url = models.TextField("Feed URL",
        validators=[URLValidator()], help_text="URL of the RSS feed",
    )
    text = models.TextField(
        "Custom title",
        blank=True,
        help_text="Custom title for the feed - defaults to feed title above",
    )
    
    # Optional data fields
    site_url = models.TextField("Site URL",
        validators=[URLValidator()], help_text="URL of the HTML site",
    )
    
    # Internal fields
    user = models.ForeignKey('auth.User')
    added = models.DateTimeField(
        auto_now_add=True, help_text="Date this feed was added",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="A feed will become inactive when a permanent error occurs",
    )
    check_frequency = models.IntegerField(
        blank=True, null=True,
        help_text="How often to check the feed for changes, in minutes",
    )
    last_updated = models.DateTimeField(
        blank=True, null=True, help_text="Last time the feed says it changed",
    )
    last_checked = models.DateTimeField(
        blank=True, null=True, help_text="Last time the feed was checked",
    )
    next_check = models.DateTimeField(
        blank=True, null=True, help_text="When the next feed check is due",
    )
    error = models.CharField(
        blank=True, max_length=255, help_text="When a problem occurs",
    )
    
    # Cached data
    count_unread = models.IntegerField(
        blank=True, null=True, help_text="Cache of number of unread items",
    )
    count_total = models.IntegerField(
        blank=True, null=True, help_text="Cache of total number of items",
    )
    
    objects = managers.FeedManager()
    
    def __unicode__(self):
        return self.text or self.title
    
    def update_count_unread(self):
        """Update the cached unread count"""
        self.count_unread = self.entries.unread().count()
        
    def update_count_total(self):
        """Update the cached total item count"""
        self.count_total = self.entries.count()
    
    def _fetch_feed(self, url_history=None):
        """
        Internal method to get the feed from the specified URL
        Follows good practice
        Returns:
            feed    Feed data, or None if there was a temporary error
            entries List of entries
        Raises:
            FetchError  Feed fetch suffered permanent failure
        """
        # Request and parse the feed
        d = feedparser.parse(self.feed_url)
        status  = d.get('status', 200)
        feed    = d.get('feed', None)
        entries = d.get('entries', [])
        
        # Handle certain feedparser exceptions (bozo):
        #   URLError    The server wasn't found
        # Other exceptions will raise a FeedError, but the feed may have been
        # parsed anyway, so feed and entries will be available on the exception
        if d.get('bozo') == 1:
            bozo = d['bozo_exception']
            if isinstance(bozo, urllib2.URLError):
                raise FeedError('URL error: %s' % bozo)
                
            # Unrecognised exception
            # Most of these will be SAXParseException, which doesn't convert
            # to a string cleanly, so explicitly mention the exception class
            raise FeedError(
                'Feed error: %s - %s' % (bozo.__class__.__name__, bozo),
                feed=feed, entries=entries,
            )
            
        # Accepted status:
        #   200 OK
        #   302 Temporary redirect
        #   304 Not Modified
        #   307 Temporary redirect
        if status in (200, 302, 304, 307):
            # Check for valid feed
            if (
                feed is None
                or 'title' not in feed
                or 'link' not in feed
            ):
                raise FeedError('Feed parsed but with invalid contents')
            
            # OK
            return feed, entries
        
        # Temporary errors:
        #   404 Not Found
        #   500 Internal Server Error
        #   502 Bad Gateway
        #   503 Service Unavailable
        #   504 Gateway Timeout
        if status in (404, 500, 502, 503, 504):
            raise FeedError('Temporary error %s' % status)
        
        # Follow permanent redirection
        if status == 301:
            # Log url
            if url_history is None:
                url_history = []
            url_history.append(self.feed_url)
            
            # Avoid circular redirection
            self.feed_url = d.get('href', self.feed_url)
            if self.feed_url in url_history:
                raise InactiveFeedError('Circular redirection found')
            
            # Update feed and try again
            self.save()
            return self._fetch_feed(url_history)
        
        # Feed gone
        if status == 410:
            raise InactiveFeedError('Feed has gone')
        
        # Unknown status
        raise FeedError('Unrecognised HTTP status %s' % status)
    
    def check(self, force=False, read=False, logfile=None):
        """
        Check the feed for updates
        
        Optional arguments:
            force       Force an update
            read        Mark new entries as read
            logfile     Logfile to print report data
        
        It will update if:
        * ``force==True``
        * it has never been updated
        * it was due for an update in the past
        * it is due for an update in the next ``MINIMUM_INTERVAL`` minutes
        
        Note: because feedparser refuses to support timeouts, this method could
        block on an unresponsive connection.
        
        The official feedparser solution is to set the global socket timeout,
        but that is not thread safe, so has not been done here in case it
        affects the use of sockets in other installed django applications.
        
        New code which calls this method directly must use the decorator
        ``yarr.decorators.with_socket_timeout`` to avoid blocking requests.
        
        For this reason, and the fact that it could take a relatively long time
        to parse a feed, this method should never be called as a direct result
        of a web request.
        """
        # Call _do_check and save if anything has changed
        changed = self._do_check(force, read, logfile)
        if changed:
            self.update_count_unread()
            self.update_count_total()
            self.save()
        
        # Remove expired entries
        self.entries.filter(expires__lte=datetime.datetime.now()).delete()
        
    def _do_check(self, force, read, logfile):
        """
        Perform the actual check from ``check``
        
        Takes the same arguments as ``check``, but returns True if something
        in the Feed object has changed, and False if it has not.
        """
        # Ensure logfile is valid
        if logfile is None:
            logfile = nullfile
        
        # Report
        logfile.write("[%s] %s" % (self.pk, self.feed_url))
        
        # Check it's due for a check before the next poll
        now = datetime.datetime.now()
        next_poll = now + datetime.timedelta(minutes=settings.MINIMUM_INTERVAL)
        if (
            not force
            and self.next_check is not None
            and self.next_check >= next_poll
        ):
            logfile.write('Not due yet')
            # Return False, because nothing has changed yet
            return False
        
        # We're about to check, update the counters
        self.last_checked = now
        self.next_check = now + datetime.timedelta(
            minutes=self.check_frequency or settings.FREQUENCY,
        )
        # Note: from now on always return True, because something has changed
        
        # Fetch feed
        logfile.write('Fetching...')
        try:
            feed, entries = self._fetch_feed()
        except FeedError, e:
            logfile.write('Error: %s' % e)
                
            # Update model to reflect the error
            if isinstance(e, InactiveFeedError):
                logfile.write('Deactivating feed')
                self.is_active = False
            self.error = str(e)
            
            # Check for a valid feed despite error
            if e.feed is None or len(e.entries) == 0:
                logfile.write('No valid feed')
                return True
            logfile.write('Valid feed found')
            feed = e.feed
            entries = e.entries
            
        else:
            # Success
            logfile.write('Feed fetched')
                
            # Clear error if necessary
            if self.error != '':
                self.error = ''
        
        # Try to find the updated time
        updated = feed.get(
            'updated_parsed',
            feed.get('published_parsed', None),
        ) 
        if updated:
            updated = datetime.datetime.fromtimestamp(
                time.mktime(updated)
            )
        
        # Stop if we now know it hasn't updated recently
        if (
            not force
            and updated
            and self.last_updated
            and updated <= self.last_updated
        ):
            logfile.write('Has not updated')
            return True
            
        # Add or update any entries, and get latest timestamp
        try:
            latest = self._update_entries(entries, read)
        except EntryError, e:
            if self.error:
                self.error += '. '
            self.error += "Entry error: %s" % e
            return True
        
        # Update last_updated
        if not updated:
            # If no feed pub date found, use latest entry
            updated = latest
        self.last_updated = updated
            
        # Update feed fields
        title = feed.get('title', None)
        site_url = feed.get('link', None)
        if title:
            self.title = title
        if site_url:
            self.site_url = site_url
        
        logfile.write('Feed updated')
        
        return True
    
    def _update_entries(self, entries, read):
        """
        Add or update feedparser entries, and return latest timestamp
        """
        latest = None
        found = []
        for raw_entry in entries:
            # Create Entry and set feed
            entry = Entry.objects.from_feedparser(raw_entry)
            entry.feed = self
            entry.state = ENTRY_READ if read else ENTRY_UNREAD
            
            # Try to match by guid, then link, then title and date
            if entry.guid:
                query = {
                    'guid': entry.guid,
                }
            elif entry.link:
                query = {
                    'link': entry.link,
                }
            elif entry.title and entry.date:
                # If title and date provided, this will match
                query = {
                    'title':    entry.title,
                    'date':     entry.date,
                }
            else:
                # No guid, no link, no title and date - no way to match
                # Can never de-dupe this entry, so to avoid the risk of adding
                # it more than once, declare this feed invalid
                raise EntryError(
                    'No guid, link, and title or date; cannot import'
                )
                
            # Update existing, or delete old
            try:
                existing = self.entries.get(**query)
            except self.entries.model.DoesNotExist:
                # New entry, save
                entry.save()
            else:
                # Existing entry
                if entry.date is not None and entry.date > existing.date:
                    # Changes - update entry
                    existing.update(entry)
            
            # Note that we found this
            found.append(entry.pk)
            
            # Update latest tracker
            if latest is None or (
                entry.date is not None and entry.date > latest
            ):
                latest = entry.date
        
        # Mark entries for expiry if:
        #   ITEM_EXPIRY is set to expire entries
        #   they weren't found in the feed
        #   they have been read (excludes those saved)
        #   they haven't already been marked for expiry
        if settings.ITEM_EXPIRY >= 0:
            self.entries.exclude(
                pk__in=found
            ).read(
            ).filter(
                expires__isnull=True
            ).update(
                expires=datetime.datetime.now() + datetime.timedelta(
                    days=settings.ITEM_EXPIRY,
                )
            )
            
        return latest
    
    class Meta:
        ordering = ('title', 'added',)



###############################################################################
#                                                               Entry model

class Entry(models.Model):
    """
    A cached entry
    
    If creating from a feedparser entry, use Entry.objects.from_feedparser()
    
    # ++ TODO: tags
    To add tags for an entry before saving, add them to _tags, and they will be
    set by save().
    """
    # Internal fields
    feed = models.ForeignKey(Feed, related_name='entries')
    state = models.IntegerField(default=ENTRY_UNREAD, choices=(
        (ENTRY_UNREAD,  'Unread'),
        (ENTRY_READ,    'Read'),
        (ENTRY_SAVED,   'Saved'),
    ))
    expires = models.DateTimeField(
        blank=True, null=True, help_text="When the entry should expire",
    )
    
    # Compulsory data fields
    title = models.TextField(blank=True)
    content = models.TextField(blank=True)
    date = models.DateTimeField(
        help_text="When this entry says it was published",
    )
    
    # Optional data fields
    author = models.TextField(blank=True)
    url = models.TextField(
        blank=True,
        validators=[URLValidator()],
        help_text="URL for the HTML for this entry",
    )
    
    comments_url = models.TextField(
        blank=True,
        validators=[URLValidator()],
        help_text="URL for HTML comment submission page",
    )
    guid = models.TextField(
        blank=True,
        help_text="GUID for the entry, according to the feed",
    )
    
    # ++ TODO: tags
    
    objects = managers.EntryManager()
    
    def __unicode__(self):
        return self.title
        
    def update(self, entry):
        """
        An old entry has been re-published; update with new data
        """
        fields = [
            'title', 'content', 'date', 'author', 'url', 'comments_url',
            'guid',
        ]
        for field in fields:
            setattr(self, field, getattr(entry, field))
        # ++ Should we mark as unread? Leaving it as is for now.
        self.save()
        
    def save(self, *args, **kwargs):
        # Default the date
        if self.date is None:
            self.date = datetime.datetime.now()
        
        # Save
        super(Entry, self).save(*args, **kwargs)
        
        # ++ TODO: tags
        """
        # Add any tags
        if hasattr(self, '_tags'):
            self.tags = self._tags
            delattr(self, '_tags')
        """
        
    class Meta:
        ordering = ('-date',)
        verbose_name_plural = 'entries'
