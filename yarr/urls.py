try:
    from django.conf.urls.defaults import patterns, url
except ImportError:
    from django.conf.urls import patterns, url, include

from yarr.constants import ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED

urlpatterns = patterns('yarr.views',
    url(r'^$', 'home',
        name="yarr-home"
    ),
    url(r'^all/$', 'list_entries',
        name="yarr-list_all",
    ),
    url(r'^unread/$', 'list_entries',
        {'state': ENTRY_UNREAD},
        name="yarr-list_unread",
    ),
    url(r'^saved/$', 'list_entries',
        {'state': ENTRY_SAVED},
        name="yarr-list_saved",
    ),
    
    # Feed views
    url(r'^all/(?P<feed_pk>\d+)/$', 'list_entries',
        name="yarr-list_all",
    ),
    url(r'^unread/(?P<feed_pk>\d+)/$', 'list_entries',
        {'state': ENTRY_UNREAD},
        name="yarr-list_unread"
    ),
    url(r'^saved/(?P<feed_pk>\d+)/$', 'list_entries',
        {'state': ENTRY_SAVED},
        name="yarr-list_saved",
    ),
    
    # Feed management
    url(r'^feeds/$', 'feeds',
        name="yarr-feeds"
    ),
    url(r'^feeds/add/$', 'feed_form',
        name="yarr-feed_add",
    ),
    url(r'^feeds/(?P<feed_pk>\d+)/$', 'feed_form',
        name="yarr-feed_edit",
    ),
    url(r'^feeds/(?P<feed_pk>\d+)/delete/$', 'feed_delete',
        name="yarr-feed_delete",
    ),
    
    # Flag management without javascript
    url(r'^state/read/all/$', 'entry_state',
        {'state': ENTRY_READ},
        name="yarr-mark_all_read",
    ),
    url(r'^state/read/feed/(?P<feed_pk>\d+)/$', 'entry_state',
        {'state': ENTRY_READ},
        name="yarr-mark_feed_read"
    ),
    url(r'^state/read/entry/(?P<entry_pk>\d+)/$', 'entry_state',
        {'state': ENTRY_READ},
        name="yarr-mark_read"
    ),
    
    url(r'^state/unread/entry/(?P<entry_pk>\d+)/$', 'entry_state',
        {'state': ENTRY_UNREAD},
        name="yarr-mark_unread",
    ),
    url(r'^state/save/entry/(?P<entry_pk>\d+)/$', 'entry_state',
        {'state': ENTRY_SAVED},
        name="yarr-mark_saved"
    ),
    
    
    #
    # JSON API
    #
    
    url(r'^api/$', 'api_base', name='yarr-api_base'),
    url(r'^api/feed/get/$', 'api_feed_get', name='yarr-api_feed_get'),
    url(r'^api/entry/get/$', 'api_entry_get', name='yarr-api_entry_get'),
    url(r'^api/entry/set/$', 'api_entry_set', name='yarr-api_entry_set'),
    
    
)

