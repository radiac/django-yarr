====================================
Django Yarr - Yet Another RSS Reader
====================================

A lightweight customisable RSS reader for Django.


Features
--------

* Import list of feeds from a Google Reader takeaway
* View all, just unread or saved items
* Mark items as read or saved
* Infinite scrolling, with keyboard support and automatic mark as read
* Support for multiple users
* Manage subscriptions through admin site
* No social nonsense

Version 0.1.0 - see CHANGES for full changelog and roadmap.


Requirements
------------

These packages are required:

* Django >= 1.3
* bleach >= 1.2.1
* feedparser >= 5.1.3


It is recommended that you use ``South`` to manage schema migrations, as future
versions of Yarr will need changes to the database.

You'll also need something to schedule feed updates - these instructions use
cron.


Installation
------------

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

6. Schedule the ``check_feeds`` management command. You could use one of these
   cron examples::

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
~~~~~~~~

Add these settings to your ``settings.py`` file to override the defaults.

To manage the web interface:

``YARR_HOME``:
    Page to open at the Yarr root url

    This setting will probably be removed in a future version.

    Default: ``yarr-list_unread``

``YARR_PAGINATION``:
    The maximum number of entries to show on one page
    
    Default: ``25``

``YARR_AJAX_PAGINATION``:
    The maximum number of entries to return when infinite scrolling with AJAX
    
    Default: ``5``

``YARR_CONTROL_FIXED``:
    If True, the control bar will switch to ``position: fixed`` when scrolling
    down moves it off the page

    Default: ``True``
  
``YARR_ADD_JQUERY``:
    If True, adds the bundled version of jQuery when required

    Default: ``True``


To control feed updates:

``YARR_FREQUENCY``:
    The default frequency to check a feed, in minutes

    The default value is set to just under 24 hours (23:45) to avoid issues
    with slow responses

    Default: ``(60 * 24) + 45``


The bleach settings can also be customised - see bleach docs for details:

``YARR_ALLOWED_TAGS``:
    Allowed HTML tags

``YARR_ALLOWED_ATTRIBUTES``:
    Allowed HTML tag attributes

``YARR_ALLOWED_STYLES``:
    Allowed styles


Templates
~~~~~~~~~

The Yarr templates extend ``yarr/base.html``, which in turn extends
``base.html``.

They will expect the following blocks:

* ``js`` for inserting JavaScript
* ``css`` for inserting CSS
* ``title`` for inserting the title (plain text)
* ``content`` for the body content

You will need to add these to your base.html template. Alternatively, if you
already have the blocks but with different names, create yarr/base.html in your
own templates folder and map them; for example::

    {% block script %}
        {{ block.super }}
        {% block js %}{% endblock %}
    {% endblock %}

Once you have mapped these blocks, the default settings and templates should
work out of the box with most designs. You should be able to further customise
most aspects of the layout and design with reasonable ease.

Note: the url to the arrow sprite is hard-coded in styles.css for the default
static url, ``/static/yarr/arrows.png``. Override ``.yarr_control .yarr_nav a``
in your stylesheet if your static url is different.


Management Commands
-------------------

Check feeds
~~~~~~~~~~~

Sees which feeds are due to be checked, and checks them for updates.

Usage::

    python manage.py check_feeds [--force] [--read] [--purge]

* ``--force`` forces updates even when not due
* ``--read`` marks new items as read (useful when first importing feeds)
* ``--purge`` purges all existing entries

Individual feeds can be given a custom checking frequency (default is 24
hours), so ``check_feeds`` needs to run at least as frequently as that; i.e. if
you want a feed to be checked every 15 minutes, set your cron job to run every
15 minutes.


Import OPML
~~~~~~~~~~~

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
-------

Thanks to existing projects which have been used as references to avoid common
pitfalls:

* http://code.google.com/p/django-reader
* https://bitbucket.org/tghw/django-feedreader

The arrow icons are from Iconic, http://somerandomdude.com/work/iconic/

The pirate pony started life on http://www.mylittledjango.com/ before putting
on clipart from clker.com and openclipart.org
