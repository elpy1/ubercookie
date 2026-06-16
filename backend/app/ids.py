"""Tracking-id helpers.

Ids are 32 lowercase hex characters (a UUID4 with the dashes removed). Every id
coming in from a header, cookie, or request body is validated against this shape
before use, which keeps attacker-controlled junk out of response headers.
"""

import re
import uuid

_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def mint() -> str:
    """Return a fresh random tracking id."""
    return uuid.uuid4().hex


def is_valid(value: str | None) -> bool:
    """True if ``value`` looks like one of our ids."""
    return bool(value) and _ID_RE.match(value) is not None


def coerce(value: str | None) -> str | None:
    """Return ``value`` if it is a valid id, else ``None``."""
    return value if is_valid(value) else None
