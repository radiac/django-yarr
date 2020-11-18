from django.conf.urls import url

from . import views
from .constants import ENTRY_READ, ENTRY_SAVED, ENTRY_UNREAD

app_name = "yarr"

urlpatterns = [
    url(r"^$", views.index, name="index",),
    url(r"^all/$", views.list_entries, name="list_all",),
    url(r"^unread/$", views.list_entries, {"state": ENTRY_UNREAD}, name="list_unread",),
    url(r"^saved/$", views.list_entries, {"state": ENTRY_SAVED}, name="list_saved",),
    # Feed views
    url(r"^all/(?P<feed_pk>\d+)/$", views.list_entries, name="list_all",),
    url(
        r"^unread/(?P<feed_pk>\d+)/$",
        views.list_entries,
        {"state": ENTRY_UNREAD},
        name="list_unread",
    ),
    url(
        r"^saved/(?P<feed_pk>\d+)/$",
        views.list_entries,
        {"state": ENTRY_SAVED},
        name="list_saved",
    ),
    # Feed management
    url(r"^feeds/$", views.feeds, name="feeds"),
    url(r"^feeds/add/$", views.feed_form, name="feed_add",),
    url(r"^feeds/(?P<feed_pk>\d+)/$", views.feed_form, name="feed_edit",),
    url(r"^feeds/(?P<feed_pk>\d+)/delete/$", views.feed_delete, name="feed_delete",),
    url(r"^feeds/export/$", views.feeds_export, name="feeds_export",),
    # Flag management without javascript
    url(
        r"^state/read/all/$",
        views.entry_state,
        {"state": ENTRY_READ, "if_state": ENTRY_UNREAD},
        name="mark_all_read",
    ),
    url(
        r"^state/read/feed/(?P<feed_pk>\d+)/$",
        views.entry_state,
        {"state": ENTRY_READ},
        name="mark_feed_read",
    ),
    url(
        r"^state/read/entry/(?P<entry_pk>\d+)/$",
        views.entry_state,
        {"state": ENTRY_READ},
        name="mark_read",
    ),
    url(
        r"^state/unread/entry/(?P<entry_pk>\d+)/$",
        views.entry_state,
        {"state": ENTRY_UNREAD},
        name="mark_unread",
    ),
    url(
        r"^state/save/entry/(?P<entry_pk>\d+)/$",
        views.entry_state,
        {"state": ENTRY_SAVED},
        name="mark_saved",
    ),
    #
    # JSON API
    #
    url(r"^api/$", views.api_base, name="api_base"),
    url(r"^api/feed/get/$", views.api_feed_get, name="api_feed_get"),
    url(r"^api/feed/pks/$", views.api_feed_pks_get, name="api_feed_pks_get"),
    url(r"^api/entry/get/$", views.api_entry_get, name="api_entry_get"),
    url(r"^api/entry/set/$", views.api_entry_set, name="api_entry_set"),
]
