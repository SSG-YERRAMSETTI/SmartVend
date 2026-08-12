"""Configuration for the VendSoft read-only client.

The API key is loaded from the environment and never rendered. `VendSoftConfig`
overrides __repr__/__str__ so the key cannot leak through accidental printing,
logging, or a traceback that includes local variables.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_BASE_URL = "https://secure.vendsoft.com/api/v2"

# backend/.env, resolved relative to this file so the loader does not depend on CWD.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_PATH = _BACKEND_DIR / ".env"


class MissingCredentials(RuntimeError):
    """Raised when VENDSOFT_API_KEY is absent. Never contains the key."""


@dataclass
class VendSoftConfig:
    base_url: str
    api_key: str = field(repr=False)

    # Conservative pacing defaults. Every one of these is intentionally slow;
    # this is a read-only survey, not a production sync.
    min_interval_s: float = 1.0        # minimum gap between requests
    timeout_s: float = 60.0            # per-request timeout
    max_retries: int = 3               # retries on 5xx / connection errors
    backoff_base_s: float = 2.0        # exponential backoff base

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return f"VendSoftConfig(base_url={self.base_url!r}, api_key=<redacted>)"

    __str__ = __repr__

    @property
    def key_fingerprint(self) -> str:
        """A stable, non-reversible id for the key, safe to log.

        Lets us confirm *which* key was used across runs without revealing it.
        """
        import hashlib

        return hashlib.sha256(self.api_key.encode("utf-8")).hexdigest()[:12]


def load_config(env_path: Path | None = None) -> VendSoftConfig:
    """Load VendSoft settings from backend/.env (or the ambient environment)."""
    path = env_path or _ENV_PATH
    if path.exists():
        load_dotenv(path, override=False)

    api_key = os.getenv("VENDSOFT_API_KEY", "").strip()
    if not api_key or api_key == "YOUR_VENDSOFT_API_KEY":
        raise MissingCredentials(
            "VENDSOFT_API_KEY is not set. Add it to backend/.env "
            "(see backend/.env.example). The value is never printed."
        )

    base_url = os.getenv("VENDSOFT_BASE_URL", "").strip() or DEFAULT_BASE_URL
    return VendSoftConfig(base_url=base_url.rstrip("/"), api_key=api_key)
