===============================
Example project for django-yarr
===============================

This example project is configured for Django 2.2.

To set it up and run the live version in a self-contained virtualenv::

    virtualenv --python=python3.8 venv
    source venv/bin/activate
    git clone git+https://github.com/radiac/django-yarr.git repo
    cd repo/example
    pip install "django<3.0"
    pip install -r ../requirements.txt

To run (still within the ``repo/example`` dir)::

    export PYTHONPATH=".."
    python manage.py migrate
    python manage.py createsuperuser
    python manage.py runserver

You can then log in at http://localhost:8000/admin/ and visit the example Yarr
installation at http://localhost:8000/.

To see something happen, try:

#. Add a feed at http://localhost:8000/feeds/
#. Run ``python manage.py check_feeds``
