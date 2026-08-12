"""VendSoft API v2 client — GET only, by construction.

Safety design
-------------
* The only HTTP entry point is `_GetOnlySession.get`, a wrapper that holds a
  `requests.Session` privately and exposes nothing but `get`/`close`. The
  underlying session is never handed out, so no caller can reach `.post`,
  `.put`, `.patch`, `.delete`, or the generic `.request`.
* `VendSoftReadClient` defines no method that maps to a write verb.
* Every request is paced by `min_interval_s` and issued sequentially.
* HTTP 429 aborts immediately (`VendSoftRateLimit`) rather than retrying.
* The API key is injected per-request into a header, never placed in a URL,
  and is scrubbed from every exception message and log line.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import requests

from .config import VendSoftConfig, load_config
from .redact import scrub_secret
from .schemas import format_dt

log = logging.getLogger("vendsoft.client")

# Response headers worth capturing for pagination / rate-limit discovery.
INTERESTING_HEADERS = (
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "ratelimit-limit",
    "ratelimit-remaining",
    "ratelimit-reset",
    "retry-after",
    "link",
    "x-total-count",
    "x-total-pages",
    "x-page",
    "x-per-page",
    "x-next-page",
    "content-range",
    "content-type",
    "content-length",
)


class VendSoftError(RuntimeError):
    """Base error. Message is always scrubbed of the API key."""


class VendSoftAuthError(VendSoftError):
    """401/403 — the key was rejected."""


class VendSoftRateLimit(VendSoftError):
    """429 — extraction must stop."""


@dataclass
class RequestRecord:
    """Audit trail for one GET. Contains no secret and no PII."""

    path: str
    params: dict[str, Any]
    status: int | None
    elapsed_s: float
    bytes_len: int
    record_count: int | None
    headers: dict[str, str] = field(default_factory=dict)
    error: str | None = None
    attempt: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "params": self.params,
            "status": self.status,
            "elapsed_s": round(self.elapsed_s, 3),
            "bytes": self.bytes_len,
            "record_count": self.record_count,
            "headers": self.headers,
            "error": self.error,
            "attempt": self.attempt,
        }


class _GetOnlySession:
    """Holds a requests.Session privately and exposes only GET."""

    __slots__ = ("_session",)

    def __init__(self) -> None:
        self._session = requests.Session()

    def get(self, url: str, **kwargs: Any) -> requests.Response:
        return self._session.get(url, **kwargs)

    def close(self) -> None:
        self._session.close()


class VendSoftReadClient:
    """Read-only access to the five documented VendSoft GET endpoints."""

    def __init__(self, config: VendSoftConfig | None = None) -> None:
        self.config = config or load_config()
        self._http = _GetOnlySession()
        self._last_request_at: float = 0.0
        self.requests_made: list[RequestRecord] = []

    # ---------------- internals ----------------

    def _scrub(self, text: str) -> str:
        return scrub_secret(str(text), self.config.api_key)

    def _pace(self) -> None:
        """Sequential pacing — never issue two requests closer than min_interval_s."""
        gap = time.monotonic() - self._last_request_at
        if self._last_request_at and gap < self.config.min_interval_s:
            time.sleep(self.config.min_interval_s - gap)

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """The single HTTP entry point of this package. Always a GET."""
        url = f"{self.config.base_url}{path}"
        params = {k: v for k, v in (params or {}).items() if v is not None}
        headers = {
            "x-api-key": self.config.api_key,
            "Accept": "application/json",
            "User-Agent": "SmartVend-VendSoft-ReadOnly/1.0 (+audit)",
        }

        last_exc: Exception | None = None
        for attempt in range(1, self.config.max_retries + 1):
            self._pace()
            started = time.monotonic()
            try:
                resp = self._http.get(
                    url, params=params, headers=headers, timeout=self.config.timeout_s
                )
            except requests.RequestException as exc:
                elapsed = time.monotonic() - started
                self._last_request_at = time.monotonic()
                msg = self._scrub(f"{type(exc).__name__}: {exc}")
                self.requests_made.append(
                    RequestRecord(path, params, None, elapsed, 0, None, {}, msg, attempt)
                )
                last_exc = VendSoftError(f"GET {path} failed: {msg}")
                if attempt < self.config.max_retries:
                    time.sleep(self.config.backoff_base_s ** attempt)
                    continue
                raise last_exc from None

            elapsed = time.monotonic() - started
            self._last_request_at = time.monotonic()
            hdrs = {
                k: v for k, v in resp.headers.items() if k.lower() in INTERESTING_HEADERS
            }
            body = resp.content or b""

            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After", "unknown")
                self.requests_made.append(
                    RequestRecord(
                        path, params, 429, elapsed, len(body), None, hdrs,
                        "rate limited", attempt,
                    )
                )
                raise VendSoftRateLimit(
                    f"GET {path} returned 429 (Retry-After={retry_after}). "
                    "Extraction stopped to stay within safe pacing."
                )

            if resp.status_code in (401, 403):
                self.requests_made.append(
                    RequestRecord(
                        path, params, resp.status_code, elapsed, len(body), None, hdrs,
                        "auth rejected", attempt,
                    )
                )
                raise VendSoftAuthError(
                    f"GET {path} returned {resp.status_code}: the API key was rejected "
                    f"(key fingerprint {self.config.key_fingerprint})."
                )

            if resp.status_code >= 500:
                self.requests_made.append(
                    RequestRecord(
                        path, params, resp.status_code, elapsed, len(body), None, hdrs,
                        "server error", attempt,
                    )
                )
                last_exc = VendSoftError(f"GET {path} returned {resp.status_code}")
                if attempt < self.config.max_retries:
                    time.sleep(self.config.backoff_base_s ** attempt)
                    continue
                raise last_exc

            if resp.status_code >= 400:
                snippet = self._scrub(resp.text[:400])
                self.requests_made.append(
                    RequestRecord(
                        path, params, resp.status_code, elapsed, len(body), None, hdrs,
                        snippet, attempt,
                    )
                )
                raise VendSoftError(f"GET {path} returned {resp.status_code}: {snippet}")

            try:
                data = resp.json()
            except ValueError as exc:
                snippet = self._scrub(resp.text[:200])
                self.requests_made.append(
                    RequestRecord(
                        path, params, resp.status_code, elapsed, len(body), None, hdrs,
                        f"invalid JSON: {exc}", attempt,
                    )
                )
                raise VendSoftError(
                    f"GET {path} returned non-JSON body: {snippet}"
                ) from None

            count = len(data) if isinstance(data, list) else None
            self.requests_made.append(
                RequestRecord(
                    path, params, resp.status_code, elapsed, len(body), count, hdrs,
                    None, attempt,
                )
            )
            return data

        raise last_exc or VendSoftError(f"GET {path} failed")

    # ---------------- documented GET endpoints ----------------

    def get_products(self) -> list[dict[str, Any]]:
        return self._get("/products")

    def get_machines(self) -> list[dict[str, Any]]:
        return self._get("/machines")

    def get_locations(self) -> list[dict[str, Any]]:
        return self._get("/locations")

    def get_planogram(self, machine_code: str) -> list[dict[str, Any]]:
        return self._get(f"/machines/{_quote(machine_code)}/planogram")

    def get_sales(
        self,
        machine_code: str,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {}
        if from_date is not None:
            params["fromDate"] = format_dt(from_date)
        if to_date is not None:
            params["toDate"] = format_dt(to_date)
        return self._get(f"/machines/{_quote(machine_code)}/sales", params)

    # ---------------- lifecycle ----------------

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "VendSoftReadClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return (
            f"VendSoftReadClient(base_url={self.config.base_url!r}, "
            f"requests_made={len(self.requests_made)})"
        )


def _quote(value: str) -> str:
    from urllib.parse import quote

    return quote(str(value), safe="")
