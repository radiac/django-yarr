import datetime
import time
import urllib2

from django.core.mail import mail_admins
from django.db import models

import bleach
import feedparser
# ++ TODO: tags

from yarr import settings


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


class FeedQuerySet(models.query.QuerySet):
    def active(self):
        """
        Filter to active feeds
        """
        return self.filter(is_active=True)
        
    def check(self, force=False, read=False):
        """
        Check active feeds for updates
        """
        for feed in self.active():
            feed.check(force, read)
        
    
class FeedManager(models.Manager):
    def active(self):
        """
        Active feeds
        """
        return self.get_query_set().active()
        
    def check(self, force=False, read=False):
        """
        Check all active feeds for updates
        """
        return self.get_query_set().check(force, read)

    def get_query_set(self):
        """
        Return a FeedQuerySet
        """
        return FeedQuerySet(self.model)


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
    title = models.TextField(help_text="Name for the feed")
    feed_url = models.URLField(help_text="URL of the RSS feed")
    
    # Optional data fields
    site_url = models.URLField(blank=True, help_text="URL of the HTML site")
    
    # Internal fields
    user = models.ForeignKey('auth.User')
    added = models.DateTimeField(
        auto_now_add=True, help_text="Date this feed was added",
    )
    is_active = models.BooleanField(
        default=True, help_text="A feed may go inactive when an error occurs",
    )
    check_frequency = models.IntegerField(
        blank=True, null=True, help_text="Check frequency, in minutes",
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
    
    objects = FeedManager()
    
    def __unicode__(self):
        return self.title
    
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
        # Request and parse the feed, and get status, feed and entries
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
    
    def check(self, force=False, read=False):
        """
        Check the feed for updates
        
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
        # Check it's due for a check
        now = datetime.datetime.now()
        if not force and self.next_check is not None and self.next_check > now:
            return
        
        # We're about to check, update the counters
        self.last_checked = now
        self.next_check = now + datetime.timedelta(
            minutes=self.check_frequency or settings.FREQUENCY,
        )
        
        # Fetch feed
        try:
            feed, entries = self._fetch_feed()
        except FeedError, e:
            # Update model to reflect the error
            if isinstance(e, InactiveFeedError):
                self.is_active = False
            self.error = str(e)
            self.save()
            
            # Check for a valid feed despite error
            if e.feed is None:
                return
            feed = e.feed
            entries = e.entries
            
        else:
            # Success, clear error if necessary
            if self.error != '':
                self.error = ''
                self.save()
        
        # Try to find the updated time
        updated = feed.get('published_parsed', None)
        if updated:
            updated = datetime.datetime.fromtimestamp(
                time.mktime(updated)
            )
        
        # Stop if we now know it hasn't updated recently
        if updated and self.last_updated and updated <= self.last_updated:
            return
        
        # Add or update any entries, and get latest timestamp
        latest = self._update_entries(entries, read)
        
        # If no feed pub date found, use latest entry
        if not updated:
            updated = latest
            
        # Update any feed fields
        changed = self._update_attrs(
            title       = feed.get('title', 'Unknown'),
            site_url    = feed.get('link', ''),
            last_updated = updated,
        )
        if changed:
            self.save()
    
    def _update_attrs(self, **attrs):
        """
        Wrapper to update a set of attributes if their values have changed
        Returns a boolean reporting whether changes have occurred or not
        """
        changed = False
        for attr, val in attrs.items():
            if getattr(self, attr) == val:
                continue
                
            setattr(self, attr, val)
            changed = True
            
        return changed
    
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
            entry.read = read
            
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
                # Rather than spam the database every check, give up
                continue
                
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
        
        # Clean out any expired entries which haven't been saved
        cleaning = self.entries.exclude(pk__in=found).filter(saved=False)
        cleaning.delete()
        
        return latest
        
    class Meta:
        ordering = ('title', 'added',)


class EntryQuerySet(models.query.QuerySet):
    def user(self, user):
        """
        Filter by user
        """
        return self.filter(feed__user=user)
        
    def read(self):
        """
        Filter to read entries
        """
        return self.filter(read=True)
        
    def unread(self):
        """
        Filter to unread entries
        """
        return self.filter(read=False)
        
    def saved(self):
        """
        Filter to saved entries
        """
        return self.filter(saved=True)
        
    def unsaved(self):
        """
        Filter to unsaved entries
        """
        return self.filter(saved=False)
        
    
class EntryManager(models.Manager):
    def user(self, user):
        """
        Filter by user
        """
        return self.get_query_set().user(user)
    
    def read(self):
        """
        Get read entries
        """
        return self.get_query_set().read()
        
    def unread(self):
        """
        Get unread entries
        """
        return self.get_query_set().unread()
        
    def saved(self):
        """
        Get saved entries
        """
        return self.get_query_set().saved()
        
    def unsaved(self):
        """
        Get unsaved entries
        """
        return self.get_query_set().unsaved()
        
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
        entry = Entry()
        
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
            'published_parsed', raw.get(
                'created_parsed', None
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

        
class Entry(models.Model):
    """
    A cached entry
    
    If creating from a feedparser entry, use Entry.objects.from_feedparser()
    
    To add tags for an entry before saving, add them to _tags, and they will be
    set by save().
    """
    # Internal fields
    feed = models.ForeignKey(Feed, related_name='entries')
    read = models.BooleanField(default=False)
    saved = models.BooleanField(default=False)
    
    # Compulsory data fields
    title = models.TextField(blank=True)
    content = models.TextField(blank=True)
    date = models.DateTimeField(
        help_text="When this entry says it was published",
    )
    
    # Optional data fields
    author = models.TextField(blank=True)
    url = models.URLField(
        blank=True,
        help_text="URL for the HTML for this entry",
    )
    comments_url = models.URLField(
        blank=True,
        help_text="URL for HTML comment submission page",
    )
    guid = models.TextField(
        blank=True,
        help_text="GUID for the entry, according to the feed",
    )
    # ++ TODO: tags
    
    objects = EntryManager()
    
    def __unicode__(self):
        return self.title
        
    def update(self, entry):
        """
        Update this entry with data from a corresponding entry
        """
        
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
