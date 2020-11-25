============
Installation
============

#. Install ``django-yarr``::

      pip install django-yarr


#. Add to ``INSTALLED_APPS``::

      INSTALLED_APPS = (
          ...
          'yarr',
      )

3. Include the URLconf in your project's urls.py::

      url(r'^yarr/', include('yarr.urls', namespace='yarr')),

4. Make sure your ``base.html`` template has the necessary blocks, or override Yarr's
   base, ``yarr/base.html`` (see `Templates`_ below). You will also want to create a
   link somewhere to ``yarr:index`` so users can access it.

5. Add the models to the database::

      python manage.py migrate yarr

6. **Optional**: Import feeds for a user from an OPML file, load all items, and mark
   them as read::

      python manage.py import_opml /path/to/subscriptions.xml username
      python manage.py check_feeds --read

   Feeds can currently only be managed through the admin section - see CHANGES for full
   roadmap.

7. Schedule the ``check_feeds`` management command. By default Yarr expects it to be run
   once an hour, but you can change the ``YARR_MINIMUM_INTERVAL`` setting to alter this.
   You could use one of these cron examples::

      # Once a day (at 8am)
      * 8 * * * /usr/bin/python /path/to/project/manage.py check_feeds

   ::

      # Every 15 minutes (0, 15, 30 and 45)
      */15 * * * * /usr/bin/python /path/to/project/manage.py check_feeds

   ::

      # Once an hour (at 10 past every hour), in a virtual environment
      10 * * * * /path/to/virtualenv/bin/python /path/to/project/manage.py check_feeds


Configuration
=============

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
    If True, use the default fixed layout - control bar at the top, feed list on the
    left, and content to the right.

    The control bar and will switch to ``position: fixed`` when scrolling down moves it
    off the page, the feed list will grow to take up the full available height, and a
    button will be added to the control bar to slide the feed list on or off to the left
    (changing the width of ``yarr_feed_list`` and the left margin of ``#yarr_content``.

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

    This should match the interval that the cron job runs at, to ensure all feeds are
    checked on time.

    Default: ``60``

``YARR_MAXIMUM_INTERVAL``:
    The maximum interval for checking a feed, in minutes - no feeds should go longer
    than this without a check.

    Default: ``24 * 60``

``YARR_FREQUENCY``:
    The default frequency to check a feed, in minutes

    Default: ``24 * 60``

``YARR_ITEM_EXPIRY``:
    The number of days to keep a read item which is no longer in the feed.

    Set this to ``0`` to expire immediately, ``-1`` to never expire.

    If changing this from ``-1``, you will probably want to add expiry dates to all
    relevant entries by forcing an update:

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
=========

The Yarr templates extend ``yarr/base.html``, which in turn extends ``base.html``.

They will expect the following blocks:

* ``js`` for inserting JavaScript
* ``css`` for inserting CSS
* ``title`` for inserting the title (plain text) - or ``{{ title }}`` instead
* ``content`` for the body content

You will need to add these to your base.html template. Alternatively, if you already
have the blocks but with different names, create yarr/base.html in your own templates
folder and map them; for example::

    {% block script %}
        {{ block.super }}
        {% block js %}{% endblock %}
    {% endblock %}

Once you have mapped these blocks, the default settings and templates should work out of
the box with most designs.

The ``content`` block in ``list_entries.html`` template contains three further blocks
for you to override:

* ``yarr_control`` for the control bar
* ``yarr_feed_list`` for the feed list
* ``yarr_content`` for the list of entries

Note: the url to the arrow sprite is hard-coded in styles.css for the default static
url, ``/static/yarr/images/arrows.png``. Override ``.yarr_control .yarr_nav a`` in your
stylesheet if your static url is different.

Forms are given basic styling using the selector ``form.yarr_form``; override the files
in ``templates/yarr/include`` to display them in the same way you do elsewhere on your
site.

Form success messages use the messages framework by default, so you should display the
``messages`` list somewhere in your template, or override the urls to add a
``success_url`` view argument to redirect to a custom page.

Yarr also uses the global javascript variables ``YARR`` and ``YARR_CONFIG``.
