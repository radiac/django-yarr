import os
from setuptools import setup, find_packages

from yarr import __version__

def read(fname):
    return open(os.path.join(os.path.dirname(__file__), fname)).read()

setup(
    name = "django-yarr",
    version = __version__,
    author = "Richard Terry",
    author_email = "python@radiac.net",
    description = ("A lightweight customisable RSS reader for Django"),
    license = "BSD",
    url = "http://radiac.net/projects/django-yarr/",
    long_description=read('README.rst'),
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: BSD License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Framework :: Django',
    ],
    
    zip_safe=True,
    install_requires=[
        'Django>=1.3.0',
        'bleach>=1.2.1',
        'feedparser>=5.1.3',
    ],
    packages=find_packages(),
    include_package_data=True,
)
