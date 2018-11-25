from django.conf import settings

import bleach


#
# To manage the web interface
#

# Page to open at Yarr root url (resolved using reverse)
INDEX_URL = getattr(settings, 'YARR_INDEX_URL', 'yarr:list_unread')

# Pagination limits
PAGE_LENGTH = getattr(settings, 'YARR_PAGE_LENGTH', 25)
API_PAGE_LENGTH = getattr(settings, 'YARR_API_PAGE_LENGTH', 5)

# If true, fix the layout elements at the top of the screen when scrolling down
# Disable if using a custom layout
LAYOUT_FIXED = getattr(settings, 'YARR_LAYOUT_FIXED', True)

# If true, add jQuery to the page when required
ADD_JQUERY = getattr(settings, 'YARR_ADD_JQUERY', True)

# Template string for document title (shown on the browser window and tabs).
# If set, used to update the title when changing feeds in list view.
# Use ``%(feed)s`` as a placeholder for the feed title (case sensitive)
TITLE_TEMPLATE = getattr(settings, 'YARR_TITLE_TEMPLATE', '%(feed)s') or ''

# jQuery Selector for page title (an element in your page template)
# If set, this element's content will be replaced with the feed title when
# changing feeds in list view.
TITLE_SELECTOR = getattr(settings, 'YARR_TITLE_SELECTOR', '') or ''


#
# To control feed updates
#

# Socket timeout, in seconds
# Highly recommended that this is **not** set to ``None``, which would block
# Note: this sets the global socket timeout, which is not thread-safe; it is
# therefore set explicitly when checking feeds, and reset after feeds have been
# updated (see ``yarr.decorators.with_socket_timeout`` for more details).
SOCKET_TIMEOUT = getattr(settings, 'YARR_SOCKET_TIMEOUT', 15)

# Minimum and maximum interval for checking a feed, in minutes
# The minimum interval must match the interval that the cron job runs at,
# otherwise some feeds may not get checked on time
MINIMUM_INTERVAL = getattr(settings, 'YARR_MINIMUM_INTERVAL', 60)
MAXIMUM_INTERVAL = getattr(settings, 'YARR_MAXIMUM_INTERVAL', 24 * 60)

# Default frequency to check a feed, in minutes
# Defaults to just under 24 hours (23:45) to avoid issues with slow responses
# Note: this will be removed in a future version
FREQUENCY = getattr(settings, 'YARR_FREQUENCY', 24 * 60)

# Number of days to keep a read item which is no longer in the feed
# Set this to 0 to expire immediately, -1 to never expire
ITEM_EXPIRY = getattr(settings, 'YARR_ITEM_EXPIRY', 1)


#
# Bleach settings for Yarr
#

# HTML whitelist for bleach
# This default list is roughly the same as the WHATWG sanitization rules
# <http://wiki.whatwg.org/wiki/Sanitization_rules>, but without form elements.
# A few common HTML 5 elements have been added as well.
ALLOWED_TAGS = getattr(
    settings, 'YARR_ALLOWED_TAGS',
    [
        'a',
        'abbr',
        'acronym',
        'aside',
        'b',
        'bdi',
        'bdo',
        'blockquote',
        'br',
        'code',
        'data',
        'dd',
        'del',
        'dfn',
        'div',  # Why not?
        'dl',
        'dt',
        'em',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'hr',
        'i',
        'img',
        'ins',
        'kbd',
        'li',
        'ol',
        'p',
        'pre',
        'q',
        's',
        'samp',
        'small',  # Now a semantic tag in HTML5!
        'span',
        'strike',
        'strong',
        'sub', 'sup',
        'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
        'time',
        'tt',  # Obsolete, but docutils likes to generate these.
        'u',
        'var',
        'wbr',
        'ul',
    ]
)
ALLOWED_ATTRIBUTES = getattr(
    settings, 'YARR_ALLOWED_ATTRIBUTES',
    {
        '*':        ['lang', 'dir'],  # lang is necessary for hyphentation.
        'a':        ['href', 'title'],
        'abbr':     ['title'],
        'acronym':  ['title'],
        'data':     ['value'],
        'dfn':      ['title'],
        'img':      ['src', 'alt', 'width', 'height', 'title'],
        'li':       ['value'],
        'ol':       ['reversed', 'start', 'type'],
        'td':       ['align', 'valign', 'width', 'colspan', 'rowspan'],
        'th':       ['align', 'valign', 'width', 'colspan', 'rowspan'],
        'time':     ['datetime'],
    }
)
ALLOWED_STYLES = getattr(
    settings, 'YARR_ALLOWED_STYLES', bleach.ALLOWED_STYLES,
)
