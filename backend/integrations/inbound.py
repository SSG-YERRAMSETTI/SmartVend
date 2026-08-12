"""The inbound request abstraction.

A provider delivery is reduced to this transport-neutral value before anything
else touches it. Keeping the rest of the pipeline off the framework request
object means parsing, hashing, and identification are testable without HTTP.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

#: Request headers that may be recorded as artifact metadata. Everything else
#: is dropped, because provider deliveries can carry credentials in headers and
#: an allowlist is the only safe default. This list is intentionally
#: conservative and will grow once the real Seed Live wire format is verified.
RECORDABLE_HEADERS = frozenset(
    {
        "content-type",
        "content-length",
        "content-encoding",
        "user-agent",
    }
)

#: Headers that must never be recorded or logged under any circumstance.
SENSITIVE_HEADERS = frozenset(
    {
        "authorization",
        "proxy-authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "api-key",
        "x-auth-token",
    }
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def filter_headers(headers: dict[str, str]) -> dict[str, str]:
    """Reduce request headers to the recordable allowlist, lowercased.

    Anything not explicitly recordable is discarded rather than redacted, so a
    provider header we have not yet assessed cannot leak into storage.
    """
    filtered: dict[str, str] = {}
    for name, value in headers.items():
        lowered = name.strip().lower()
        if lowered in SENSITIVE_HEADERS:
            continue
        if lowered in RECORDABLE_HEADERS:
            filtered[lowered] = value
    return filtered


@dataclass(frozen=True)
class InboundReportRequest:
    """One provider delivery, independent of the transport that carried it.

    `payload` holds the exact bytes received. Nothing decodes, normalizes, or
    re-encodes them before they are hashed and preserved.
    """

    payload: bytes
    content_type: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    source_filename: str | None = None
    received_at: datetime = field(default_factory=utc_now)
    #: Optional report-type hint supplied by a provider adapter that has a
    #: *verified* source for one. A hint is never truth: it is corroborating
    #: evidence a connector may weigh when identifying a payload.
    #:
    #: No adapter sets this today. For Cantaloupe / Seed Live we have not
    #: verified whether the provider conveys a report type at all, nor how, so
    #: choosing a source now would be inventing the contract. Candidates once a
    #: real delivery is captured: a header, the filename, a query parameter,
    #: content disposition, body structure, or the transport configuration.
    report_type_hint: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.payload, (bytes, bytearray)):
            raise TypeError("payload must be bytes")
        if self.received_at.tzinfo is None:
            raise ValueError("received_at must be timezone-aware")

    @property
    def size_bytes(self) -> int:
        return len(self.payload)


class PayloadTooLarge(ValueError):
    """The delivery exceeded the configured size limit."""

    def __init__(self, limit_bytes: int) -> None:
        super().__init__(f"payload exceeds the {limit_bytes} byte limit")
        self.limit_bytes = limit_bytes


class EmptyPayload(ValueError):
    """The delivery carried no body."""

    def __init__(self) -> None:
        super().__init__("payload is empty")
