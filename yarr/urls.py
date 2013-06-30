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
    
    # Non-ajax flag management
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
    
    # Ajax list
    url(r'^api/list/$', 'api_list',
        name="yarr-api_list",
    ),
    
    # Ajax flag management
    url(r'^api/entry/$', 'api_entry',
        name="yarr-api_entry",
    ),
)

