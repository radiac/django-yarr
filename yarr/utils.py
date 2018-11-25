"""
Utils for yarr
"""
import json
import six
from xml.dom import minidom
from xml.etree.ElementTree import Element, SubElement, ElementTree

from django.core.paginator import Paginator, EmptyPage, InvalidPage
from django.core.serializers.json import DjangoJSONEncoder
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse

from . import settings
from . import models


def paginate(request, qs, adjacent_pages=3):
    """
    Paginate a querystring and prepare an object for building links in template
    Returns:
        paginated   Paginated items
        pagination  Info for template
    """
    paginator = Paginator(qs, settings.PAGE_LENGTH)
    try:
        page = int(request.GET.get('p', '1'))
    except ValueError:
        page = 1
    try:
        paginated = paginator.page(page)
    except (EmptyPage, InvalidPage):
        paginated = paginator.page(paginator.num_pages)

    # Prep pagination vars
    total_pages = paginator.num_pages
    start_page = max(paginated.number - adjacent_pages, 1)
    if start_page <= 3:
        start_page = 1

    end_page = paginated.number + adjacent_pages + 1
    if end_page >= total_pages - 1:
        end_page = total_pages + 1

    def page_dict(number):
        """
        A dictionary which describes a page of the given number.  Includes
        a version of the current querystring, replacing only the "p" parameter
        so nothing else is clobbered.
        """
        query = request.GET.copy()
        query['p'] = str(number)
        return {
            'number': number,
            'query': query.urlencode(),
            'current': number == paginated.number,
        }

    page_numbers = [
        n for n in range(start_page, end_page) if n > 0 and n <= total_pages
    ]

    if 1 not in page_numbers:
        first = page_dict(1)
    else:
        first = None

    if total_pages not in page_numbers:
        last = page_dict(total_pages)
    else:
        last = None

    pagination = {
        'has_next':     paginated.has_next(),
        'next':         page_dict(paginated.next_page_number()) if paginated.has_next() else None,

        'has_previous': paginated.has_previous(),
        'previous':     page_dict(paginated.previous_page_number()) if paginated.has_previous() else None,

        'show_first':   first is not None,
        'first':        first,
        'pages':        [page_dict(n) for n in page_numbers],
        'show_last':    last is not None,
        'last':         last,
    }

    return paginated, pagination


def jsonEncode(data):
    return json.dumps(data, cls=DjangoJSONEncoder)

def jsonResponse(data):
    """
    Return a JSON HttpResponse
    """
    return HttpResponse(jsonEncode(data), content_type='application/json')

def import_opml(file_path, user, purge=False):
    if purge:
        models.Feed.objects.filter(user=user).delete()

    xmldoc = minidom.parse(file_path)

    new = []
    existing = []
    for node in xmldoc.getElementsByTagName('outline'):
        url_node = node.attributes.get('xmlUrl', None)
        if url_node is None:
            continue
        url = url_node.value

        title_node = node.attributes.get('title', None)
        title = title_node.value if title_node else url
        site_node = node.attributes.get('htmlUrl', None)
        site_url = site_node.value if site_node else ''

        try:
            feed = models.Feed.objects.get(
                title=title,
                feed_url=url,
                site_url=site_url,
                user=user
            )
            existing.append(feed)
        except ObjectDoesNotExist:
            feed = models.Feed(
                title=title,
                feed_url=url,
                site_url=site_url,
                user=user
            )
            new.append(feed)

    models.Feed.objects.bulk_create(new)
    return len(new), len(existing)


def export_opml(user):
    """
    Generate a minimal OPML export of the user's feeds.

    :param user: Django User object
    :param stream: writable file-like object to which the XML is written
    """
    root = Element('opml', {'version': '1.0'})

    head = SubElement(root, 'head')
    title = SubElement(head, 'title')
    title.text = u'{0} subscriptions'.format(user.username)

    body = SubElement(root, 'body')

    for feed in user.feed_set.all():
        item = SubElement(body, 'outline', {
            'type': 'rss',
            'text': feed.title,
            'title': feed.title,
            'xmlUrl': feed.feed_url,
        })
        if feed.site_url:
            item.set('htmlUrl', feed.site_url)

    buf = six.BytesIO()
    ElementTree(root).write(buf, encoding="UTF-8")
    return buf.getvalue()
