from django.conf import settings

import bleach


#
# To manage the web interface
#

# Page to open at Yarr root url (resolved using reverse)
HOME = getattr(settings, 'YARR_HOME', 'yarr-list_unread')

# Pagination limits
PAGE_LENGTH = getattr(settings, 'YARR_PAGE_LENGTH', 25)
API_PAGE_LENGTH = getattr(settings, 'YARR_API_PAGE_LENGTH', 5)

# If true, fix the layout elements at the top of the screen when scrolling down
# Disable if using a custom layout
LAYOUT_FIXED = getattr(settings, 'YARR_LAYOUT_FIXED', True)

# If true, add jQuery to the page when required
ADD_JQUERY = getattr(settings, 'YARR_ADD_JQUERY', True)


#
# To control feed updates
#

# Socket timeout, in seconds
# Highly recommended that this is **not** set to ``None``, which would block
# Note: this sets the global socket timeout, which is not thread-safe; it is
# therefore set explicitly when checking feeds, and reset after feeds have been
# updated (see ``yarr.decorators.with_socket_timeout`` for more details).
SOCKET_TIMEOUT = getattr(settings, 'YARR_SOCKET_TIMEOUT', 15)

# Default frequency to check a feed, in minutes
# Defaults to just under 24 hours (23:45) to avoid issues with slow responses
# Note: this will be removed in a future version
FREQUENCY = getattr(settings, 'YARR_FREQUENCY', (60 * 23) + 45)

# Minimum and maximum interval for checking a feed, in minutes
MINIMUM_INTERVAL = getattr(settings, 'YARR_MINIMUM_INTERVAL', 60)
MAXIMUM_INTERVAL = getattr(settings, 'YARR_MAXIMUM_INTERVAL', 24 * 60)



#
# Bleach settings for Yarr
#

# HTML whitelist for bleach
ALLOWED_TAGS = getattr(
    settings, 'YARR_ALLOWED_TAGS',
    [
        'a',
        'abbr',
        'acronym',
        'b',
        'blockquote',
        'br',
        'code',
        'em',
        'i',
        'img',
        'li',
        'ol',
        'p',
        'pre',
        'strong',
        'table', 'tr', 'th', 'td',
        'ul',
    ]
)
ALLOWED_ATTRIBUTES = getattr(
    settings, 'YARR_ALLOWED_ATTRIBUTES',
    {
        'a':        ['href', 'title'],
        'abbr':     ['title'],
        'acronym':  ['title'],
        'img':      ['src', 'width', 'height', 'title'],
        'th':       ['align', 'valign', 'width', 'colspan', 'rowspan'],
        'td':       ['align', 'valign', 'width', 'colspan', 'rowspan'],
    }
)
ALLOWED_STYLES = getattr(
    settings, 'YARR_ALLOWED_STYLES', bleach.ALLOWED_STYLES,
)
