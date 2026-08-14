"""Deterministic content hashing and idempotency key derivation.

Both functions are pure and byte-exact. Provider payloads are hashed as raw
bytes with no normalization of any kind, including line endings: a report whose
bytes differ is a different artifact, because the raw bytes are the evidence we
preserve and later re-verify against.
"""

from __future__ import annotations

import hashlib

#: Recorded alongside every hash so a future change of algorithm is detectable
#: rather than silently producing mismatches.
HASH_ALGORITHM = "sha256"

_FIELD_SEPARATOR = b"\x00"


def content_hash(payload: bytes) -> str:
    """SHA-256 of the exact payload bytes, lowercase hex.

    No normalization. This is the deduplication basis and the evidence hash.
    """
    if not isinstance(payload, (bytes, bytearray)):
        raise TypeError("payload must be bytes")
    return hashlib.sha256(bytes(payload)).hexdigest()


def idempotency_key(
    *,
    org_id: str,
    connection_id: str,
    provider: str,
    payload_hash: str,
) -> str:
    """Derive a stable key identifying one delivered artifact.

    The same payload delivered twice on the same connection yields the same
    key, so a resend is recognised as a replay rather than new data. Different
    organizations (tenants) or connections never collide, even for
    byte-identical payloads, because two customers can legitimately receive the
    same report content.

    Only the *values* are hashed; field names are not part of the digest, so
    the 2026-08-14 rename of this parameter from `tenant_id` to `org_id` left
    every derived key byte-identical. `test_hashing.py` pins the digest to a
    literal so that stays true.

    DEFERRED, future persistence checkpoint: `org_id` is a string today. When
    it begins to come from `organizations.id`, which is UUID-backed, the
    repository adapter must canonicalize it before it reaches this function.
    Two equivalent UUID spellings would otherwise hash to different keys and
    silently defeat replay detection.

    Report type is deliberately excluded: identification can fail or change as
    the provider contract becomes known, and the key must stay stable across
    that. The payload hash already distinguishes different content.

    Fields are joined with a NUL separator so that no combination of values can
    be rearranged to produce the same input string.
    """
    for name, value in (
        ("org_id", org_id),
        ("connection_id", connection_id),
        ("provider", provider),
        ("payload_hash", payload_hash),
    ):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{name} must be a non-empty string")
        if "\x00" in value:
            raise ValueError(f"{name} must not contain a NUL byte")

    digest = hashlib.sha256()
    digest.update(
        _FIELD_SEPARATOR.join(
            part.encode("utf-8")
            for part in (org_id, connection_id, provider, payload_hash)
        )
    )
    return digest.hexdigest()
