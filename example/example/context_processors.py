"""
Webpack context processor

If you are looking at this to see how to use powerwiki, you can ignore this file
"""
import logging
import socket

from django.conf import settings
from django.http.request import split_domain_port


logger = logging.getLogger(__name__)


def webpack_dev_url(request):
    """
    If webpack dev server is running, add HMR context processor so template can
    switch script import to HMR URL
    """
    if not getattr(settings, "WEBPACK_DEV_URL", None):
        return {}

    data = {"host": split_domain_port(request._get_raw_host())[0]}

    hmr_socket = socket.socket()
    try:
        hmr_socket.connect(
            (settings.WEBPACK_DEV_HOST.format(**data), settings.WEBPACK_DEV_PORT)
        )

    except socket.error:
        # No HMR server
        logger.warning("Webpack dev server not found\n")
        return {}

    finally:
        hmr_socket.close()

    # HMR server found
    logger.info("Webpack dev server found, HMR enabled\n")

    context = {"YARR_WEBPACK_DEV_URL": settings.WEBPACK_DEV_URL.format(**data)}
    return context
