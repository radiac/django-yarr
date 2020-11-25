import socket

from . import settings


def with_socket_timeout(fn):
    """
    Call a function while the global socket timeout is ``YARR_SOCKET_TIMEOUT``

    The socket timeout value is set before calling the function, then reset to
    the original timeout value afterwards

    Note: This is not thread-safe.
    """

    def wrap(*args, **kwargs):
        # Set global socket
        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(settings.SOCKET_TIMEOUT)

        # Call fn
        r = fn(*args, **kwargs)

        # Reset global socket
        socket.setdefaulttimeout(old_timeout)

        return r

    return wrap
