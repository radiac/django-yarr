import os
import re
import sys

from setuptools import find_packages, setup

from yarr import __version__ as VERSION


def read(fname):
    return open(os.path.join(os.path.dirname(__file__), fname)).read()


def runtests(args):
    "Run tests"
    import django
    from django.conf import settings
    from django.core.management import execute_from_command_line

    if not settings.configured:
        testenv = re.sub(
            r"[^a-zA-Z0-9]",
            "_",
            os.environ.get("TOXENV", "_".join(str(v) for v in django.VERSION)),
        )

        SETTINGS = dict(
            INSTALLED_APPS=[
                "django.contrib.auth",
                "django.contrib.admin",
                "django.contrib.sessions",
                "django.contrib.contenttypes",
                "django.contrib.messages",
                "yarr",
                "tests",
            ],
            MIDDLEWARE=[
                "django.middleware.common.CommonMiddleware",
                "django.contrib.sessions.middleware.SessionMiddleware",
                "django.contrib.auth.middleware.AuthenticationMiddleware",
                "django.contrib.messages.middleware.MessageMiddleware",
            ],
            TEMPLATES=[
                {
                    "BACKEND": "django.template.backends.django.DjangoTemplates",
                    "APP_DIRS": True,
                    "OPTIONS": {
                        "context_processors": [
                            "django.contrib.auth.context_processors.auth",
                            "django.contrib.messages.context_processors.messages",
                        ],
                    },
                }
            ],
            USE_TZ=True,
        )

        # Build database settings
        DATABASE = {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
        DATABASE["TEST"] = DATABASE.copy()
        SETTINGS["DATABASES"] = {
            "default": DATABASE,
        }

        # Configure
        settings.configure(**SETTINGS)

    execute_from_command_line(args[:1] + ["test"] + (args[2:] or ["tests"]))


if len(sys.argv) > 1 and sys.argv[1] == "test":
    runtests(sys.argv)
    sys.exit()


setup(
    name="django-yarr",
    version=VERSION,
    author="Richard Terry",
    author_email="code@radiac.net",
    description=("A lightweight customisable RSS reader for Django"),
    license="BSD",
    url="http://radiac.net/projects/django-yarr/",
    long_description=read("README.rst"),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Environment :: Web Environment",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: BSD License",
        "Operating System :: OS Independent",
        "Programming Language :: Python",
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.4",
        "Programming Language :: Python :: 3.5",
        "Programming Language :: Python :: 3.6",
        "Framework :: Django",
        "Framework :: Django :: 1.11",
        "Framework :: Django :: 2.0",
        "Framework :: Django :: 2.1",
    ],
    install_requires=[
        "Django>=1.11.0",
        "bleach>=1.2.1",
        "feedparser>=5.1.3",
        "six",
        "django-yaa-settings",
    ],
    extras_require={
        "dev": [
            # Testing
            "tox",
            # Docs
            "sphinx",
            "sphinx-autobuild",
            "sphinx_rtd_theme",
        ],
    },
    zip_safe=True,
    packages=find_packages(
        exclude=(
            "docs",
            "tests*",
        )
    ),
    include_package_data=True,
)
