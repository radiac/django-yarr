import os

import django
from django.contrib.auth.models import User
from django.test import TestCase

from yarr.models import Feed
from yarr.decorators import with_socket_timeout

from .opml import ExportTests

__all__ = ['ExportTests', 'FeedTest']


class FeedTest(TestCase):
    def setUp(self):
        test_path = os.path.dirname(__file__)
        user = User.objects.create_user(
            'test', 'test@example.com', 'test',
        )
        self.feed_wellformed = Feed.objects.create(
            title="Feed: well-formed",
            user=user,
            feed_url=os.path.join(test_path, 'feed1-wellformed.xml')
        )
        self.feed_malformed = Feed.objects.create(
            title="Feed: malformed",
            user=user,
            feed_url=os.path.join(test_path, 'feed2-malformed.xml')
        )
        
        self.feed_missing_server = Feed.objects.create(
            title="Feed: missing server",
            user=user,
            feed_url='http://missing.example.com/',
        )

        self.feed_with_img = Feed.objects.create(
            title="Feed: has <img>",
            user=user,
            feed_url=os.path.join(test_path, 'feed4-with-img.xml')
        )
        
    def test_feed_wellformed(self):
        """
        Test wellformed feed
        """
        # Update the feed
        self.feed_wellformed.check()
        
        # Check the feed data
        self.assertEqual(
            self.feed_wellformed.site_url,
            'http://example.com/wellformed',
        )
        
        # Check the entries (newest first)
        entries = self.feed_wellformed.entries.all()[0:]
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].feed, self.feed_wellformed)
        self.assertEqual(entries[0].title, 'Item 2')
        self.assertEqual(entries[0].content, 'Content 2')
        self.assertEqual(entries[0].url, 'http://example.com/?item=2')
        # ++ Cannot assert date without knowing server timezone
        self.assertEqual(entries[1].title, 'Item 1')
        self.assertEqual(entries[1].content, 'Content 1')
        self.assertEqual(entries[1].url, 'http://example.com/?item=1')
        
    def test_feed_malformed(self):
        """
        Test malformed feed
        """
        # Update the feed
        self.feed_malformed.check()
        
        # Check the feed data
        self.assertEqual(self.feed_malformed.site_url, '')
        self.assertEqual(self.feed_malformed.is_active, True)
        self.assertRegexpMatches(
            self.feed_malformed.error,
            r'^Feed error: SAXParseException - '
        )
    
    @with_socket_timeout
    def test_http_error(self):
        """
        Test HTTP errors
        """
        # Update the feed
        self.feed_missing_server.check()
        
        # Check the feed object
        self.assertEqual(self.feed_missing_server.is_active, True)
        self.assertRegexpMatches(
            self.feed_missing_server.error,
            r'^URL error: .+?Name or service not known',
        )

    # assertHTMLEqual was introduced in Django 1.5.  And of course skipIf was
    # introduced in Python 2.7 or Django 1.5, so we have to do this the jank
    # way in case of Django < 1.5 on Python 2.6 (we don't care about Python
    # 2.5, do we?)
    if django.VERSION >= (1, 5):
        def test_feed_with_img(self):
            """
            With the default settings, an ``<img>`` tag should be permitted
            ``src``, ``alt``, ``title``, ``width``, and ``height`` attributes.
            """
            # Update the feed.
            self.feed_with_img.check()
            (entry,) = self.feed_with_img.entries.all()

            self.assertHTMLEqual(
                entry.content,
                '<img src="http://example.com/webcomic.png" alt="alt text" '
                    'title="annoying in-joke" width="100" height="200">'
            )
