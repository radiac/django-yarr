#!/usr/bin/env python

import sys
import os

from django.conf import settings


def configure_django():
    installed_apps = (
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.admin',
        'yarr',
    )
    if os.environ.get('USE_SOUTH', ''):
        installed_apps += ('south',)

    settings.configure(
        DEBUG=True,
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
            }
        },
        ROOT_URLCONF='yarr.urls',
        USE_TZ=False,
        INSTALLED_APPS=installed_apps,
    )

if __name__ == '__main__':
    configure_django()

    import django
    from django.core.management import execute_from_command_line

    # Test discovery changed in Django 1.6 to require a full import path rather
    # than an app label.
    if django.VERSION >= (1, 6):
        args = ['yarr.tests']
    else:
        args = ['yarr']

    execute_from_command_line(sys.argv[0:1] + ['test'] + args)
