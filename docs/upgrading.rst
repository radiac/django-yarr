=========
Upgrading
=========

For an overview of what has changed between versions, see the :ref:`changelog`.


Instructions
============

1. Check which version of Tagulous you are upgrading from::

      python
      >>> import yarr
      >>> yarr.__version__

2. Upgrade the Yarr package::

    pip install --upgrade django-yarr

3. Scroll down to the earliest instructions relevant to your version, and follow them up
   to the latest version.

   For example, to upgrade from 0.3.8, follow the instruction for 0.3.13, then 0.3.12,
   but not 0.3.6 or earlier.



Upgrading from 0.5.0
--------------------

Version 0.6.0 makes significant frontend changes so you will need to update your site
template and stylesheets. In particular, Yarr now uses a pure CSS for its layout, and
will expand to fit within its container element. It's recommended to make this container
the full width and height of the page (less any persistent header etc).

See the example project for details.


Upgrading from 0.4.5
--------------------

1.  This version switches from South migrations to Django migrations:

    1. Remove ``south`` from your ``INSTALLED_APPS``
    2. Run ``python manage.py migrate yarr``

2.  URLs are now namespaced; the ``yarr-home`` page is now renamed to
    ``yarr:index``

3.  The setting ``YARR_HOME`` is now ``YARR_INDEX_URL``


Upgrading from 0.4.2 or earlier
-------------------------------

If you have customised your installation of Yarr, you may be affected by the following
changes:

* CSS borders on ``.yarr_mode_list`` and ``.yarr_mode_list .yarr_entry`` have changed -
  same visible effect, but allows ``.yarr_content`` to force the scroll element's height
  in fixed layout.

* Your Yarr URLs cannot contain a slug ``00``. AJAX mode now adds URLs to the browser's
  history by building URLs in Django with a feed pk of ``00``, then passing them to
  JavaScript which replaces ``/00/`` with the feed pk.  In the unlikely event your Yarr
  URL does contain ``00``, the AJAX site will still work, but the URLs it generates will
  be invalid.


Upgrading from 0.4.1 or earlier
-------------------------------

Run::

    python manage.py migrate yarr


Upgrading from 0.4.0 or earlier
-------------------------------

A bug in older versions may have led to incorrect unread counts on feeds. The count will
be corrected as soon as an item in that feed is read or unread, but you can correct all
feeds immediately with::

    python manage.py yarr_clean --update_cache


Upgrading from 0.3.13 or earlier
--------------------------------

New settings are available:

* ``YARR_TITLE_TEMPLATE`` to update the document title (window and tabs)
* ``YARR_TITLE_SELECTOR`` to update the page title (in your template)


If you have customised your installation of Yarr, you may be affected by the following
changes:

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
--------------------------------

In earlier versions, entry expiry didn't function correctly. This release fixes
the issue, but because expiry dates are set when a feed updates, you will have to wait
for all feeds to change before expiry dates are set correctly (meaning some old entries
will sit around in your database for longer than they need to, which could waste disk
space if you have a lot of feeds).

To address this, ``check_feeds --force`` has been changed to not just force a check of
all feeds, but also to force a database update, which will set an expiry on all entries
no longer in a feed. To force expiries onto entries that should expire::

    python manage.py check_feeds --force

Bear in mind that entries on dead feeds will not be touched; this is the intended
behaviour (in case the feed is temporarily unavailable), but may mean that you are left
with some entries which should have expired. If this is an issue for you, you can delete
the feed (and all entries along with it), or manually delete read unsaved entries on
inactive feeds with::

    python manage.py yarr_clean --delete_read


Upgrading from 0.3.6 or earlier
-------------------------------

Changes to templates and static:

* The old ``yarr/base.html`` has moved to ``yarr/base_all.html``, and the new
  ``yarr/base.html`` is empty. This will make it simpler to override the Yarr
  base template without needing to copy the cs and js blocks, which will change
  in future versions.
* New global javascript variables ``YARR`` and ``YARR_CONFIG``
* Paths to static resources have changed


Upgrading from 0.3.0 or earlier
-------------------------------

Changes to templates:

* Entries now render titles as ``<h2>`` instead of ``<h1>``, for valid HTML4.
* Some elements have had their selectors changes (notably ``#yarr_content`` to
  ``.yarr_content``).

Changes to settings, if you have overridden the defaults:

* Rename ``YARR_CONTROL_FIXED`` to ``YARR_LAYOUT_FIXED``
* Note that default for ``YARR_FREQUENCY`` has changed to 24 hours now that
  feeds are checked before they are next due instead of after.


Upgrading to 0.2.0
------------------

Change the following settings, if you have overridden the defaults:

* Rename ``YARR_PAGINATION`` to ``YARR_PAGE_LENGTH``
* Rename ``YARR_API_PAGINATION`` to ``YARR_API_PAGE_LENGTH``


Changelog
=========

0.6.2, 2021-02-21
-----------------

Changes:

* Restyle active read entries so default title colour is darker


Bugfix:

* Remove missing images from manage table
* Fix JS failure to mark as read
* Fix ``check_feeds`` when multiple feeds share a url


0.6.1, 2020-11-25
-----------------

Changes:

* Update example project
* Clean source


Bugfix:

* Add missing styles
* Fix JS load order


0.6.0, 2020-11-18
-----------------

Features:

* Add support for Django 2.2 - 3.1
* Reimplement frontend to use a CSS-based layout

Changes:

* Drop support for Django <2.1


0.5.0, 2014-11-09
-----------------

Features:

* Add support for Django 1.7 (#44)

Thanks to

* windedge for #44


0.4.5, 2014-05-10
-----------------

Bugfix:

* Use json instead of deprecated simplejson (fixes #42)


0.4.4, 2014-04-24
-----------------

Features:

* Added ``check_feeds --url``

Bugfix:

* Fixed bug triggered when feed entries lacked guids


0.4.3, 2014-02-21
-----------------

Features:

* URL history updates to reflect state
* Tox test support (#9, #39)

Bugfix:

* Control bar no longer jumps around when in fixed layout
* Fixed reST syntax in upgrade notes (#38)
* Fixed race condition when changing feeds while scrolled

Thanks to:

* Spencer Herzberg (sherzberg) for #9
* Tom Most (twm) for #38 and #39


0.4.2, 2014-02-13
-----------------

Bugfix:

* Improved compatibility of raw SQL to update count cache

Internal:

* Changed count_unread and count_total to not null in db


0.4.1, 2014-02-13
-----------------

Feature:

* Added OPML export (#33)
* Can now mark all read without reloading page
* Added yarr_clean management command for help upgrading

Bugfix:

* Static read all button only changes state of unread
* Fixed load status appearing at wrong time
* Fixed list mode click having incorrect effect
* Fixed scrollTo error
* Expiry dates are reset when item state changes
* Mark all read updates unread count correctly (#35)
* Expiring entries updates total count correctly
* Fixed dropdown bugs

Internal:

* Optimised unread and total count updates
* All templates have div wrappers (#37)

Thanks to:

* Tom Most (twm) for #33 and #37


0.4.0, 2014-02-06
-----------------

Feature:

* Simplified control bar
* Can now change feeds without reloading page (fixes #27)
* Can now change filter and order without reloading page
* Simplified save/read state, save indicated in list mode

Bugfix:

* Changed Entry .save and .read to .state (fixes #35)
* Added Feed.text for user-customisable title (fixes #34)
* Unread count updates correctly when reading items
* Unread count shows next to abreviated feed
* Feed toggle correctly determines feedlist width

Internal:

* Refactored list_entries.js


0.3.13, 2014-01-05
------------------

Feature:

* Changed check_feeds --force to also force a db update
* Allow more HTML tags in entries (#32)

Bugfix:

* Fixed entries not expiring correctly
* Unread count at 0 removes class (#31)
* Fixed urls.py for Django 1.6 (#30)

Thanks to:

* Chris Franklin (chrisfranklin) for #30
* Tom Most (twm) for #31 and #32


0.3.12, 2013-11-19
------------------

Bugfix:

* Fixed scroll buttons sprite


0.3.11, 2013-11-15
------------------

Feature:

* Add unread count to feed list (#29)
* Minor feed management tweaks (#26)
* Add wrapper <span> for checkbox style-ability (#25)
* Longer entry snippets in list mode (#24)
* Items only scroll on click in list mode (#23)
* Added basic styling for unread count
* Clarified parts of the instructions
* Changed icons to ones based on Entypo

Thanks to:

* Tom Most (twm) for all above changes


0.3.10, 2013-10-23
------------------

Internal:

* Use render(), not render_to_response() (#20)

Bugfix:

* Removed debug messages from feeds.js

Thanks to:

* Tuk Bredsdorff (tiktuk) for #20


0.3.9, 2013-09-20
-----------------

Bugfix:

* Fixed layout fixed setting in views.list_entries


0.3.8, 2013-09-15
-----------------

Feature:

* Added toggle to display feed items oldest first (#18)
* Changed sanitiser to allow ``<img alt>`` (#16)

Bugfix:

* Fixed ``YARR_LAYOUT_FIXED = False`` (#17)
* Added documentation regarding timezones (#15)

Thanks to:

* Tom Most (twm) for all changes


0.3.7, 2013-08-06
-----------------

Internal:

* Import feed refactor for better reuse (#10)

Thanks to:

* Spencer Herzberg (sherzberg) for all changes


0.3.6, 2013-07-20
-----------------

Feature:

* Added expandable info to feed manager list
* Added shortcut key to open source URL in new window (#5)
* Added setting to control how long old entries remain
* Added link to delete feed on edit feed page

Internal:

* Added cached item counts to Feed

Internal:

* Restructured template inheritance to simplify overrides

Bugfix:

* Added missing code to update an item that has changed
* Changed check_feeds to check for entries if feed broken

Thanks to:

* Aleksandr Pasechnik (russkey) for #5


0.3.5, 2013-07-17
-----------------

Bugfix:

* Changed "Mark as read" to mark a feed if selected (#4)


0.3.4, 2013-07-17
-----------------

Feature:

* Added cookie-based memory of visible/hidden feed list

Bugfix:

* Fixed detection of initial feed list visiblity

Thanks to:

* Aleksandr Pasechnik (russkey)


0.3.3, 2013-07-12
-----------------

Bugfix:

* Fixed bug in feed check that caused it to trigger early


0.3.2, 2013-07-10
-----------------

Feature:

* Added ``--verbose`` option to ``feed_check`` command

Bugfix:

* Feed last_checked value now always updated

Thanks to:

* chanshik: Idea for ``feed_check`` verbosity


0.3.1, 2013-07-09
-----------------

Feature:

* Added 'Problem' status to feed manager


0.3.0, 2013-07-09
-----------------

Feature:

* Added feed list, browse by feed
* Added feed manager
* Added cookie-based memory of expanded/list view

Bugfix:

* Changed check_feeds to check any due in the next period
* Fixed infinite scroll still loading at end of scroll
* Fixed mark as read to change item style without reload
* Fixed double parsing by disabling feedparser sanitizer

Change:

* Changed roadmap


0.2.0, 2013-07-05
-----------------

Feature:

* Added list view
* Replaced API with more sensible get/set model

Bugfix:

* Changed feed check to keep feed title if none provided
* Fixed clicking on items in infinite scroll


0.1.5, 2013-07-05
-----------------

Bugfix:

* Replaced checks for updated_parsed, suppress warnings


0.1.4, 2013-07-05
-----------------

Bugfix:

* Changed URLFields to TextFields with URL validator


0.1.3, 2013-07-04
-----------------

Feature:

* Added tests

Bugfix:

* Changed title, guid and author fields to TextField
* Fixed incorrect call to _feed_fetch
* Added feedparser bozo flag handling
* Added socket timeout
* Fixed title field in template

Change:

* Changed roadmap

Thanks to:

* Andrew Rowson (growse): Model change and other bugfixes
* chanshik: Raising socket timeout issue

0.1.2, 2013-06-30
-----------------

Feature:

* Added j/k shortcut keys


0.1.1, 2013-06-30
-----------------

Bugfix:

* Changed js to disable API when API URLs unavailable


0.1.0, 2013-06-29
-----------------

Feature:

* Initial release
