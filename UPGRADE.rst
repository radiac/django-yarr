=====================
Upgrading Django Yarr
=====================

If a release isn't listed here, there are no special instructions for upgrading
to that version.


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
