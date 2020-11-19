import difflib
from xml.dom import minidom
from xml.etree import ElementTree

from django.contrib.auth.models import User
from django.test import TestCase

from yarr.utils import export_opml


class ExportTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("test", "test@example.com", "test")

    def test_empty(self):
        """
        An empty OPML document is generated for a user with no feeds.
        """
        expected = (
            '<opml version="1.0">'
            "<head>"
            "<title>test subscriptions</title>"
            "</head>"
            "<body/>"
            "</opml>"
        )
        self.assert_equal_xml(expected, export_opml(self.user))

    def test_single_feed(self):
        self.user.feed_set.create(
            title=u"Feed 1", feed_url="http://example.com/feed.xml"
        )
        expected = (
            '<opml version="1.0">'
            "<head>"
            "<title>test subscriptions</title>"
            "</head>"
            "<body>"
            '<outline type="rss" xmlUrl="http://example.com/feed.xml"'
            ' title="Feed 1" text="Feed 1" />'
            "</body>"
            "</opml>"
        )
        self.assert_equal_xml(expected, export_opml(self.user))

    def test_unicode_title(self):
        self.user.feed_set.create(
            title=u"\u2042", feed_url="http://example.com/feed.xml"
        )
        expected = (
            u'<opml version="1.0">'
            "<head>"
            "<title>test subscriptions</title>"
            "</head>"
            "<body>"
            '<outline type="rss" xmlUrl="http://example.com/feed.xml"'
            u' title="\u2042" text="\u2042" />'
            "</body>"
            "</opml>"
        ).encode("utf-8")
        self.assert_equal_xml(expected, export_opml(self.user))

    def test_site_url(self):
        self.user.feed_set.create(
            title=u"Example",
            feed_url="http://example.com/feed.xml",
            site_url="http://example.com/",
        )
        expected = (
            '<opml version="1.0">'
            "<head>"
            "<title>test subscriptions</title>"
            "</head>"
            "<body>"
            '<outline type="rss" xmlUrl="http://example.com/feed.xml"'
            ' htmlUrl="http://example.com/"'
            ' title="Example" text="Example" />'
            "</body>"
            "</opml>"
        )
        self.assert_equal_xml(expected, export_opml(self.user))

    def assert_equal_xml(self, a, b):
        """
        Poor man's XML differ.
        """
        a_el = ElementTree.fromstring(a)
        b_el = ElementTree.fromstring(b)
        if not etree_equal(a_el, b_el):
            a_str = pretty_etree(a_el).splitlines()
            b_str = pretty_etree(b_el).splitlines()
            diff = difflib.unified_diff(a_str, b_str, fromfile="a", tofile="b")
            full_diff = u"\n".join(diff).encode("utf-8")
            self.fail("XML not equivalent:\n\n{}".format(full_diff))


def pretty_etree(e):
    s = ElementTree.tostring(e, "utf-8")
    return minidom.parseString(s).toprettyxml(indent="    ")


def etree_equal(a, b):
    """
    Determine whether two :class:`xml.etree.ElementTree.Element` trees are
    equivalent.

    >>> from xml.etree.ElementTree import Element, SubElement as SE, fromstring
    >>> a = fromstring('<root/>')
    >>> b = fromstring('<root/>')
    >>> etree_equal(a, a), etree_equal(a, b)
    (True, True)
    >>> c = fromstring('<root attrib="value" />')
    >>> d = fromstring('<root attrib="value" />')
    >>> etree_equal(a, c), etree_equal(c, d)
    (False, True)
    """
    return (
        a.tag == b.tag
        and a.text == b.text
        and a.tail == b.tail
        and a.attrib == b.attrib
        and len(a) == len(b)
        and all(etree_equal(x, y) for (x, y) in zip(a, b))
    )
