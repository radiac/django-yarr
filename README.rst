====================================
Django Yarr - Yet Another RSS Reader
====================================

A lightweight customisable RSS reader for Django.

Example: http://radiac.net/projects/django-yarr/example/


Features
========

* Import list of feeds from a Google Reader takeaway
* View all, by feed, just unread or saved items
* List or expanded layout
* Mark items as read or saved
* Infinite scrolling, with keyboard support and automatic mark as read
* Support for multiple users
* Manage subscriptions through user views or admin site
* No social nonsense


Version 0.3.5

* See `CHANGES <CHANGES>`_ for full changelog and roadmap
* See `UPGRADE <UPGRADE.rst>`_ for how to upgrade from earlier releases


Requirements
============

These packages are required:

* Django >= 1.3
* feedparser >= 5.1.3
* bleach >= 1.2.1


It is recommended that you use ``South`` to manage schema migrations, as future
versions of Yarr will need changes to the database.

You'll also need something to schedule feed updates - these instructions use
cron.


Installation
============

* See 

1. Install ``django-yarr`` (currently only on github)::

    pip install -e git+https://github.com/radiac/django-yarr.git#egg=django-yarr

2. Add Yarr to ``INSTALLED_APPS``::

    INSTALLED_APPS = (
        ...
        'yarr',
    )

   Note: If you are using Django 1.4 or later, you will need to set
   ``USE_TZ = False``, until support for Django 1.3 is dropped from Yarr.

3. Include the URLconf in your project's urls.py::

    url(r'^yarr/', include('yarr.urls')),

4. Add the models to the database using South::

    python manage.py migrate yarr

   * If you don't have South, you will use ``python manage.py syncdb``, and
   later regret your decision

5. **Optional**: Import feeds for a user from an OPML file, load all items, and
   mark them as read::

    python manage.py import_opml /path/to/subscriptions.xml username
    python manage.py check_feeds --read

   Feeds can currently only be managed through the admin section - see CHANGES
   for full roadmap.

6. Schedule the ``check_feeds`` management command. By default Yarr expects it
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

7. Create a link to ``yarr-home`` (or ``yarr.views.home``) for users to access
   Yarr.


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


The bleach settings can also be customised - see bleach docs for details:

``YARR_ALLOWED_TAGS``:
    Allowed HTML tags

``YARR_ALLOWED_ATTRIBUTES``:
    Allowed HTML tag attributes

``YARR_ALLOWED_STYLES``:
    Allowed styles


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
static url, ``/static/yarr/arrows.png``. Override ``.yarr_control .yarr_nav a``
in your stylesheet if your static url is different.

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

    python manage.py check_feeds [--force] [--read] [--purge]

* ``--force`` forces updates even when not due
* ``--read`` marks new items as read (useful when first importing feeds)
* ``--purge`` purges all existing entries
* ``--verbose`` displays information about feeds as they are being checked

Individual feeds can be given a custom checking frequency (default is 24
hours), so ``check_feeds`` needs to run at least as frequently as that; i.e. if
you want a feed to be checked every 15 minutes, set your cron job to run every
15 minutes.


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


.. image:: http://radiac.net/projects/django-yarr/logo-large.png


Credits
=======

Thanks to all contributors, who are listed in CHANGES.

Thanks to existing projects which have been used as references to avoid common
pitfalls:

* http://code.google.com/p/django-reader
* https://bitbucket.org/tghw/django-feedreader

The icons are from Iconic, http://somerandomdude.com/work/iconic/

The pirate pony started life on http://www.mylittledjango.com/ before putting
on clipart from clker.com and openclipart.org
