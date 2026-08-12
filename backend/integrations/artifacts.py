"""Raw provider artifacts: the evidence layer.

Every inbound payload is recorded here before anything parses it. A parse
failure never loses the payload, and a stored artifact can be replayed to
reproduce canonical state or re-verified against its hash.

Artifacts are immutable. A corrected resend creates a new artifact that
supersedes the old one; it never overwrites it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from integrations.hashing import HASH_ALGORITHM
from integrations.providers import Provider
from typing import Protocol

#: Report type recorded when identification did not succeed. The artifact is
#: still preserved: an unrecognised report is a finding to investigate, never a
#: reason to discard evidence.
UNKNOWN_REPORT_TYPE = "unknown"


class ArtifactState(str, Enum):
    """Processing lifecycle of one artifact."""

    #: Persisted, not yet processed.
    RECEIVED = "received"
    #: Handed to processing.
    QUEUED = "queued"
    #: Successfully parsed and transformed.
    PARSED = "parsed"
    #: Parsing failed. The payload is retained and the reason recorded.
    FAILED = "failed"
    #: Replaced by a later artifact carrying corrected content.
    SUPERSEDED = "superseded"
    #: Recognised as a byte-identical replay of an artifact already held.
    DUPLICATE = "duplicate"


@dataclass(frozen=True)
class RawReportArtifact:
    """Metadata for one preserved provider delivery.

    The payload bytes themselves live in the artifact store, addressed by
    `storage_ref`. This record carries only metadata, so it is safe to log and
    to return in an API response.

    Contains no credential, no header that could carry one, and no payload
    content.
    """

    id: str
    tenant_id: str
    connection_id: str
    provider: Provider
    report_type: str
    received_at: datetime
    payload_hash: str
    size_bytes: int
    idempotency_key: str
    state: ArtifactState = ArtifactState.RECEIVED
    hash_algorithm: str = HASH_ALGORITHM
    content_type: str | None = None
    source_filename: str | None = None
    #: Provider schema version, when the payload allows it to be determined.
    report_version: str | None = None
    storage_ref: str | None = None
    parse_error: str | None = None
    transport_metadata: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.received_at.tzinfo is None:
            raise ValueError("received_at must be timezone-aware")
        if self.size_bytes < 0:
            raise ValueError("size_bytes must not be negative")

    @property
    def is_identified(self) -> bool:
        return self.report_type != UNKNOWN_REPORT_TYPE


class DuplicateArtifact(Exception):
    """An artifact with the same idempotency key is already stored.

    Carries the existing artifact so the caller can acknowledge the replay with
    the original identifier instead of creating a second record.
    """

    def __init__(self, existing: RawReportArtifact) -> None:
        super().__init__(f"artifact already stored: {existing.idempotency_key}")
        self.existing = existing


class ArtifactStore(Protocol):
    """Persists raw payloads and their metadata.

    Implementations write the bytes to durable storage and the metadata to the
    database. The interface is defined now so the inbound boundary can be built
    and tested; the storage decision itself is open and requires coordination
    with the parallel workstream before any schema is created.
    """

    def store(self, artifact: RawReportArtifact, payload: bytes) -> RawReportArtifact:
        """Persist payload and metadata, returning the stored artifact.

        Must raise `DuplicateArtifact` when an artifact with the same
        idempotency key already exists, so replays are recognised rather than
        duplicated.

        Implementations write the payload before the metadata, so a failure
        between the two leaves recoverable evidence rather than a metadata row
        pointing at nothing.
        """
        ...

    def find_by_idempotency_key(self, key: str) -> RawReportArtifact | None:
        """Return the stored artifact for this key, or None."""
        ...
