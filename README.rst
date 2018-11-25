====================================
Django Yarr - Yet Another RSS Reader
====================================

A lightweight customisable RSS reader for Django.

http://radiac.net/projects/django-yarr/

Example: http://radiac.net/projects/django-yarr/demo/


Features
========

* Easy to install - simple requirements, just drops into your site
* Import and export list of feeds using OPML
* View all, by feed, just unread or saved items
* List or expanded layout
* Mark items as read or saved
* Infinite scrolling, with keyboard support and automatic mark as read
* Support for multiple users
* Manage subscriptions through user views or admin site
* No social nonsense


Version 0.5.0

(see the `roadmap <CHANGES>`_ for details).

* See `CHANGES <CHANGES>`_ for full changelog and roadmap
* See `UPGRADE <UPGRADE.rst>`_ for how to upgrade from earlier releases


Requirements
============

Yarr supports Django 1.11 or later on Python 2.7 and 3.4+.

These additional packages are required:

* feedparser >= 5.1.3
* bleach >= 1.2.1

You'll need something to schedule feed updates - these instructions use cron.


Installation
============

1. Install ``django-yarr`` (currently only on github)::

    pip install -e git+https://github.com/radiac/django-yarr.git#egg=django-yarr

   Note: The master branch may sometimes contain minor changes made since the
   version was incremented. These changes will be listed in
   `CHANGES <CHANGES>`_. It will always be safe to use, but versions will be
   tagged if you only want to follow releases.

2. Add Yarr to ``INSTALLED_APPS``::

    INSTALLED_APPS = (
        ...
        'yarr',
    )

3. Include the URLconf in your project's urls.py::

    url(r'^yarr/', include('yarr.urls', namespace='yarr')),

4. Make sure your ``base.html`` template has the necessary blocks, or override
   Yarr's base, ``yarr/base.html`` (see `Templates`_ below). You will also want
   to create a link somewhere to ``yarr:index`` so users can access it.

5. Add the models to the database using Django migrations::

    python manage.py migrate yarr

6. **Optional**: Import feeds for a user from an OPML file, load all items, and
   mark them as read::

    python manage.py import_opml /path/to/subscriptions.xml username
    python manage.py check_feeds --read

   Feeds can currently only be managed through the admin section - see CHANGES
   for full roadmap.

7. Schedule the ``check_feeds`` management command. By default Yarr expects it
   to be run once an hour, but you can change the ``YARR_MINIMUM_INTERVAL``
   setting to alter this. You could use one of these cron examples::

    # Once a day (at 8am)
    * 8 * * * /usr/bin/python /path/to/project/manage.py check_feeds

   ::

    # Every 15 minutes (0, 15, 30 and 45)
    */15 * * * * /usr/bin/python /path/to/project/manage.py check_feeds

   ::

    # Once an hour (at 10 past every hour), in a virtual environment
    10 * * * * /path/to/virtualenv/bin/python /path/to/project/manage.py check_feeds


Settings
--------

Add these settings to your ``settings.py`` file to override the defaults.

To manage the web interface:

``YARR_HOME``:
    Page to open at the Yarr root url

    This setting will probably be removed in a future version.

    Default: ``yarr-list_unread``

``YARR_PAGE_LENGTH``:
    The maximum number of entries to show on one page

    Default: ``25``

``YARR_API_PAGE_LENGTH``:
    The maximum number of entries to return when infinite scrolling with AJAX

    Default: ``5``

``YARR_LAYOUT_FIXED``:
    If True, use the default fixed layout - control bar at the top, feed list
    on the left, and content to the right.

    The control bar and will switch to ``position: fixed`` when scrolling down
    moves it off the page, the feed list will grow to take up the full
    available height, and a button will be added to the control bar to slide
    the feed list on or off to the left (changing the width of
    ``yarr_feed_list`` and the left margin of ``#yarr_content``.

    Default: ``True``

``YARR_ADD_JQUERY``:
    If True, adds the bundled version of jQuery when required

    Default: ``True``


To control feed updates:

``YARR_SOCKET_TIMEOUT``:
    The default socket timeout, in seconds

    Highly recommended that this is **not** set to ``None``, which would block

    Default: ``30``


``YARR_MINIMUM_INTERVAL``:
    The minimum interval for checking a feed, in minutes.

    This should match the interval that the cron job runs at, to ensure all
    feeds are checked on time.

    Default: ``60``

``YARR_MAXIMUM_INTERVAL``:
    The maximum interval for checking a feed, in minutes - no feeds should go
    longer than this without a check.

    Default: ``24 * 60``

``YARR_FREQUENCY``:
    The default frequency to check a feed, in minutes

    Default: ``24 * 60``

``YARR_ITEM_EXPIRY``:
    The number of days to keep a read item which is no longer in the feed.

    Set this to ``0`` to expire immediately, ``-1`` to never expire.

    If changing this from ``-1``, you will probably want to add expiry dates to
    all relevant entries by forcing an update:

        python manage.py check_feeds --force

    Default: ``1``



The bleach settings can also be customised - see bleach docs for details:

``YARR_ALLOWED_TAGS``:
    Allowed HTML tags

``YARR_ALLOWED_ATTRIBUTES``:
    Allowed HTML tag attributes

``YARR_ALLOWED_STYLES``:
    Allowed styles

Note that the default Yarr templates use ``STATIC_URL``, so your
``TEMPLATE_CONTEXT_PROCESSORS`` should include
``django.core.context_processors.static`` - it is there by default.


Templates
---------

The Yarr templates extend ``yarr/base.html``, which in turn extends
``base.html``. To minimise the risk of interfering with your site templates,
they use HTML4.

They will expect the following blocks:

* ``js`` for inserting JavaScript
* ``css`` for inserting CSS
* ``title`` for inserting the title (plain text) - or ``{{ title }}`` instead
* ``content`` for the body content

You will need to add these to your base.html template. Alternatively, if you
already have the blocks but with different names, create yarr/base.html in your
own templates folder and map them; for example::

    {% block script %}
        {{ block.super }}
        {% block js %}{% endblock %}
    {% endblock %}

Once you have mapped these blocks, the default settings and templates should
work out of the box with most designs.

The ``content`` block in ``list_entries.html`` template contains three further
blocks for you to override:

* ``yarr_control`` for the control bar
* ``yarr_feed_list`` for the feed list
* ``yarr_content`` for the list of entries

Note: the url to the arrow sprite is hard-coded in styles.css for the default
static url, ``/static/yarr/images/arrows.png``. Override
``.yarr_control .yarr_nav a`` in your stylesheet if your static url is
different.

Forms are given basic styling using the selector ``form.yarr_form``; override
the files in ``templates/yarr/include`` to display them in the same way you do
elsewhere on your site.

Form success messages use the messages framework by default, so you should
display the ``messages`` list somewhere in your template, or override the urls
to add a ``success_url`` view argument to redirect to a custom page.

Yarr also uses the global javascript variables ``YARR`` and ``YARR_CONFIG``.


Management Commands
===================

Check feeds
-----------

Sees which feeds are due to be checked, and checks them for updates.

Usage::

    python manage.py check_feeds [--force] [--read] [--purge] [--url=<URL>]

* ``--force`` forces all feeds to update (slow)
* ``--read`` marks new items as read (useful when first importing feeds)
* ``--purge`` purges all existing entries
* ``--verbose`` displays information about feeds as they are being checked
* ``--url=<URL>`` specifies the feed URL to update (must be in the database)

Specifying a feed URL will filter the feeds before any action is taken, so if
used with ``purge``, only that feed will be purged. If no feed URL is
specified, all feeds will be processed.

Individual feeds can be given a custom checking frequency (default is 24
hours), so ``check_feeds`` needs to run at least as frequently as that; i.e. if
you want a feed to be checked every 15 minutes, set your cron job to run every
15 minutes.

Although multiple ``check_feed`` calls can run at the same time without
interfering with each other, if you are running the command manually you may
want to temporarily disable your cron job to avoid checking feeds
unnecessarily.


Import OPML
-----------

Imports feeds from an OPML file into the specified username.

Usage::

    python manage.py import_opml /path/to/subscriptions.xml username [--purge]

* ``/path/to/subscriptions.xml`` should be the path to the OPML file
* ``username`` is the username to associate the feeds with; the user must exist
* ``--purge`` purges all existing feeds

Only tested with the OPML from a Google Reader takeaway, but should work with
any OPML file where the feeds are specified using the attribute ``xmlUrl``.


Clean Yarr
----------

Primarily for use during upgrades - performs maintenance tasks to ensure the
Yarr database is clean. Useful when upgrading (`UPGRADE <UPGRADE.rst>`_ will
tell you which option to use and when), and can be used to clean up if
something breaks in an unexpected way.

Usage::

    python manage.py yarr_clean [--delete_read] [--update_cache]

* ``--delete_read`` will delete all read entries which haven't been saved
* ``--update_cache`` will update the cached feed unread and total counts


Usage
=====

You can browse items by feed and/or unread/saved status. There are two display
modes; expanded mode just lists the full items one after another, and list mode
shows a list of titles which can be expanded to see the item.

Items will be marked as read once they are opened in list mode, or when they
are scrolled to or selected in expanded mode. Once something is marked as read,
it can expire. An item can either be read or saved, but not both.

Feeds can be managed on the ``Manage feeds`` page. If a feed had a problem, its
status icon will be an orange warning, and if it is no longer available it will
be a red error. To see the reason for a warning or error, click somewhere on
the row. To edit the feed's settings, click on its title.


Shortcut keys
-------------

* ``n`` or ``j``: Next item
* ``p`` or ``k``: Previous item
* ``v`` or ``ENTER``: View original (in new window)


Credits
=======

Thanks to all contributors, who are listed in CHANGES.

Thanks to existing projects which have been used as references to avoid common
pitfalls:

* http://code.google.com/p/django-reader
* https://bitbucket.org/tghw/django-feedreader

The icons are based on Entypo by Daniel Bruce, http://www.entypo.com/

The pirate pony started life on http://www.mylittledjango.com/ before putting
on clipart from clker.com and openclipart.org
