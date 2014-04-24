=====================
Upgrading Django Yarr
=====================

1. Check which version of Yarr you are upgrading from::

    python
    >>> import yarr
    >>> yarr.__version__

2. Upgrade the Yarr package::

    pip install -e git+https://github.com/radiac/django-yarr.git#egg=django-yarr

3. Follow all sections of the instructions below until you reach an earlier
   version than the one you are upgrading from (found in step 1)

   For example, to upgrade from 0.3.8, follow the instruction for 0.3.13,
   then 0.3.12, but not 0.3.6 or earlier.


Upgrading from 0.4.2 or earlier
===============================

If you have customised your installation of Yarr, you may be affected by the
following changes:

* CSS borders on ``.yarr_mode_list`` and ``.yarr_mode_list .yarr_entry`` have
  changed - same visible effect, but allows ``.yarr_content`` to force the
  scroll element's height in fixed layout.
* Your Yarr URLs cannot contain a slug ``00``. AJAX mode now adds URLs to the
  browser's history by building URLs in Django with a feed pk of ``00``, then
  passing them to JavaScript which replaces ``/00/`` with the feed pk.
  In the unlikely event your Yarr URL does contain `00``, the AJAX site will
  still work, but the URLs it generates will be invalid.


Upgrading from 0.4.1 or earlier
===============================

Run::

    python manage.py migrate yarr


Upgrading from 0.4.0 or earlier
===============================

A bug in older versions may have led to incorrect unread counts on feeds. The
count will be corrected as soon as an item in that feed is read or unread, but
you can correct all feeds immediately with::

    python manage.py yarr_clean --update_cache


Upgrading from 0.3.13 or earlier
================================

New settings are available:

* ``YARR_TITLE_TEMPLATE`` to update the document title (window and tabs)
* ``YARR_TITLE_SELECTOR`` to update the page title (in your template)


If you have customised your installation of Yarr, you may be affected by the
following changes:

* In ``list_entries.html``:

  +  The elements ``div.yarr_control`` and ``div.yarr_feed_list`` have had
     several significant changes to structure, style and js enhancements
  +  The data attributes on ``div.yarr_con`` have been removed

* The ``Entry`` model attributes ``.read`` and ``.saved`` have been replaced
  by ``.state``, with corresponding constants in ``constants.py``
* The views ``mark_read`` and ``mark_saved`` have been replaced by
  ``entry_state``
* The named url ``yarr-mark_unsaved`` has been removed, and state urls now
  start with the prefix ``state/``
* The API calls for entries have changed to use the new state attribute
* The template ``include/entry.html`` now sets the attr ``data-yarr-state``,
  instead of ``data-yarr-read`` and ``data-yarr-saved``
* The script ``static/yarr/js/list_entries.js`` has been refactored


Upgrading from 0.3.12 or earlier
================================

In earlier versions, entry expiry didn't function correctly. This release fixes
the issue, but because expiry dates are set when a feed updates, you will have
to wait for all feeds to change before expiry dates are set correctly
(meaning some old entries will sit around in your database for longer than they
need to, which could waste disk space if you have a lot of feeds).

To address this, ``check_feeds --force`` has been changed to not just force a
check of all feeds, but also to force a database update, which will set an
expiry on all entries no longer in a feed. To force expiries onto entries that
should expire::

    python manage.py check_feeds --force

Bear in mind that entries on dead feeds will not be touched; this is the
intended behaviour (in case the feed is temporarily unavailable), but may mean
that you are left with some entries which should have expired. If this is an
issue for you, you can delete the feed (and all entries along with it), or
manually delete read unsaved entries on inactive feeds with::

    python manage.py yarr_clean --delete_read


Upgrading from 0.3.6 or earlier
===============================

Changes to templates and static:

* The old ``yarr/base.html`` has moved to ``yarr/base_all.html``, and the new
  ``yarr/base.html`` is empty. This will make it simpler to override the Yarr
  base template without needing to copy the cs and js blocks, which will change
  in future versions.
* New global javascript variables ``YARR`` and ``YARR_CONFIG``
* Paths to static resources have changed


Upgrading from 0.3.0 or earlier
===============================

Changes to templates:

* Entries now render titles as ``<h2>`` instead of ``<h1>``, for valid HTML4.
* Some elements have had their selectors changes (notably ``#yarr_content`` to
  ``.yarr_content``).

Changes to settings, if you have overridden the defaults:

* Rename ``YARR_CONTROL_FIXED`` to ``YARR_LAYOUT_FIXED``
* Note that default for ``YARR_FREQUENCY`` has changed to 24 hours now that
  feeds are checked before they are next due instead of after.


Upgrading to 0.2.0
==================

Change the following settings, if you have overridden the defaults:

* Rename ``YARR_PAGINATION`` to ``YARR_PAGE_LENGTH``
* Rename ``YARR_API_PAGINATION`` to ``YARR_API_PAGE_LENGTH``
