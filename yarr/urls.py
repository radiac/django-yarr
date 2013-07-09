from django.conf.urls.defaults import patterns, include, url

import django.contrib.auth.views

urlpatterns = patterns('yarr.views',
    url(r'^$', 'home',
        name="yarr-home"
    ),
    url(r'^unread/$', 'list_entries',
        name="yarr-list_unread"
    ),
    url(r'^all/$', 'list_entries',
        {'unread': False},
        name="yarr-list_all",
    ),
    url(r'^saved/$', 'list_entries',
        {'saved': True},
        name="yarr-list_saved",
    ),
    
    # Feed views
    url(r'^unread/(?P<feed_pk>\d+)/$', 'list_entries',
        name="yarr-list_unread"
    ),
    url(r'^all/(?P<feed_pk>\d+)/$', 'list_entries',
        {'unread': False},
        name="yarr-list_all",
    ),
    url(r'^saved/(?P<feed_pk>\d+)/$', 'list_entries',
        {'saved': True},
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
    
    # Flag management without javascript
    url(r'^read/$', 'mark_read',
        name="yarr-mark_all_read",
    ),
    url(r'^read/(?P<entry_pk>\d+)/$', 'mark_read',
        name="yarr-mark_read"
    ),
    url(r'^unread/(?P<entry_pk>\d+)/$', 'mark_read',
        {'is_read': False},
        name="yarr-mark_unread",
    ),
    url(r'^save/(?P<entry_pk>\d+)/$', 'mark_saved',
        name="yarr-mark_saved",
    ),
    url(r'^unsave/(?P<entry_pk>\d+)/$', 'mark_saved',
        {'is_saved': False},
        name="yarr-mark_unsaved",
    ),
    
    
    
    #
    # JSON API
    #
    
    url(r'^api/entry/get/$', 'api_entry_get',
        name="yarr-api_entry_get",
    ),
    
    url(r'^api/entry/set/$', 'api_entry_set',
        name="yarr-api_entry_set",
    ),
    
    
)

