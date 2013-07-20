=====================
Upgrading Django Yarr
=====================

If a release isn't listed here, there are no special instructions for upgrading
to that version.

Upgrading to 0.3.6
==================

(from == 0.3.0)

Update the yarr package, then run::

    ./manage migrate yarr

Changes to templates and static:

* The old ``yarr/base.html`` has moved to ``yarr/base_all.html``, and the new
  ``yarr/base.html`` is empty. This will make it simpler to override the Yarr
  base template without needing to copy the cs and js blocks, which will change
  in future versions.
* New global javascript variables ``YARR`` and ``YARR_CONFIG``
* Paths to static resources have changed


Upgrading to 0.3.0
==================

(from == 0.2.0)

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

(from == 0.1.5)

Change the following settings, if you have overridden the defaults:

* Rename ``YARR_PAGINATION`` to ``YARR_PAGE_LENGTH``
* Rename ``YARR_API_PAGINATION`` to ``YARR_API_PAGE_LENGTH``


Upgrading to 0.1.4
==================

(from <= 0.1.3)

Update the yarr package, then run::

    ./manage migrate yarr
