"""Read-only VendSoft API v2 client.

This package is deliberately incapable of writing to VendSoft. See client.py.
"""

from .client import VendSoftReadClient, VendSoftError, VendSoftAuthError, VendSoftRateLimit

__all__ = [
    "VendSoftReadClient",
    "VendSoftError",
    "VendSoftAuthError",
    "VendSoftRateLimit",
]
