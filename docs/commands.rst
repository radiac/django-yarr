===================
Management Commands
===================

Check feeds
===========

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
===========

Imports feeds from an OPML file into the specified username.

Usage::

    python manage.py import_opml /path/to/subscriptions.xml username [--purge]

* ``/path/to/subscriptions.xml`` should be the path to the OPML file
* ``username`` is the username to associate the feeds with; the user must exist
* ``--purge`` purges all existing feeds

Only tested with the OPML from a Google Reader takeaway, but should work with
any OPML file where the feeds are specified using the attribute ``xmlUrl``.


Clean Yarr
==========

Primarily for use during upgrades - performs maintenance tasks to ensure the Yarr
database is clean. Upgrade instructions will tell you when to run this.

Usage::

    python manage.py yarr_clean [--delete_read] [--update_cache]

* ``--delete_read`` will delete all read entries which haven't been saved
* ``--update_cache`` will update the cached feed unread and total counts
