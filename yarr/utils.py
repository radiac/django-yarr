"""
Utils for yarr
"""
import os
from xml.dom import minidom

from django.core.paginator import Paginator, EmptyPage, InvalidPage
from django.core.serializers.json import DjangoJSONEncoder
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse
from django.utils import simplejson

from yarr import settings
from yarr import models


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

    page_numbers = [
        n for n in range(start_page, end_page) if n > 0 and n <= total_pages
    ]

    pagination = {
        'has_next':     paginated.has_next(),
        'next':         paginated.next_page_number() if paginated.has_next() else 0,

        'has_previous': paginated.has_previous(),
        'previous':     paginated.previous_page_number() if paginated.has_previous() else 0,

        'current':      paginated.number,
        'show_first':   1 not in page_numbers,
        'page_numbers': page_numbers,
        'show_last':    total_pages not in page_numbers,
        'total':        total_pages,
    }

    return paginated, pagination


def jsonEncode(data):
    return simplejson.dumps(data, cls=DjangoJSONEncoder)

def jsonResponse(data):
    """
    Return a JSON HttpResponse
    """
    return HttpResponse(jsonEncode(data), mimetype='application/json')

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
