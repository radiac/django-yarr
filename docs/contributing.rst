============
Contributing
============

Contributions are welcome, preferably via pull request. Check the github issues and
project `Roadmap`_ to see what needs work. If you're thinking about adding a new
feature, it's worth opening a new ticket to check it's not already being worked on
elsewhere.


Building the frontend
=====================

If you need to make changes to the JavaScript, you can build it with::

    nvm use
    yvm use
    yarn install
    npm run build

**Please do not submit your built resources** to reduces commit and diff noise.

If you want to use HMR you can run::

    npm run watch

with the example project.

We aim to support the latest versions of browsers through progressive enhancement;
ideally old browsers should still be able to access all functionality, even if the
experience isn't quite as smooth.


Testing
=======

It is greatly appreciated when contributions come with unit tests.

Use ``pytest`` to run the tests on your current installation, or ``tox`` to run it on
the supported variants::

  pytest
  tox

These will also generate a ``coverage`` HTML report.


Roadmap
=======

* Support custom user models
* Improve test coverage
* Feed categorisation and entry tags
* De-dupe multiple feeds with the same URL before checking
* Customise HTML sanitiser to support:
    * Support whitelist of embedded media (eg youtube)
    * Delay image loading
    * Improve render time
* Option to ping for unread count updates
* Refresh button
* Adaptive feed check frequency, with smarter


Credits
=======

Thanks to all contributors who are listed in ``yarr.__credits__``.

Thanks to existing projects which have been used as references to avoid common
pitfalls:

* http://code.google.com/p/django-reader
* https://bitbucket.org/tghw/django-feedreader

The icons are from Remix Icon, https://remixicon.com/

The pirate pony started life on http://www.mylittledjango.com/ before putting
on clipart from clker.com and openclipart.org
