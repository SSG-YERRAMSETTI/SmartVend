"""Deterministic hashing and idempotency derivation."""

from __future__ import annotations

import hashlib

import pytest

from integrations.hashing import HASH_ALGORITHM, content_hash, idempotency_key

PAYLOAD = b"transaction,amount\r\n1,2.50\r\n"


class TestContentHash:
    def test_matches_sha256_of_exact_bytes(self) -> None:
        assert content_hash(PAYLOAD) == hashlib.sha256(PAYLOAD).hexdigest()

    def test_is_stable(self) -> None:
        assert content_hash(PAYLOAD) == content_hash(PAYLOAD)

    def test_line_endings_are_not_normalized(self) -> None:
        """Raw evidence is byte-exact. CRLF and LF are different artifacts."""
        crlf = b"a,b\r\n1,2\r\n"
        lf = b"a,b\n1,2\n"
        assert content_hash(crlf) != content_hash(lf)

    def test_single_byte_change_is_detected(self) -> None:
        assert content_hash(b"1,2.50") != content_hash(b"1,2.51")

    def test_empty_payload_hashes(self) -> None:
        assert content_hash(b"") == hashlib.sha256(b"").hexdigest()

    def test_binary_payload_is_supported(self) -> None:
        payload = bytes(range(256))
        assert content_hash(payload) == hashlib.sha256(payload).hexdigest()

    def test_rejects_str(self) -> None:
        with pytest.raises(TypeError):
            content_hash("not bytes")  # type: ignore[arg-type]

    def test_algorithm_is_recorded(self) -> None:
        assert HASH_ALGORITHM == "sha256"


class TestIdempotencyKey:
    def _key(self, **overrides: str) -> str:
        fields = {
            "tenant_id": "tenant-a",
            "connection_id": "conn-1",
            "provider": "cantaloupe",
            "payload_hash": content_hash(PAYLOAD),
        }
        fields.update(overrides)
        return idempotency_key(**fields)  # type: ignore[arg-type]

    def test_is_deterministic(self) -> None:
        assert self._key() == self._key()

    def test_same_payload_on_same_connection_replays(self) -> None:
        """The property the whole replay-safety guarantee rests on."""
        assert self._key() == self._key()

    def test_different_tenant_does_not_collide(self) -> None:
        assert self._key() != self._key(tenant_id="tenant-b")

    def test_different_connection_does_not_collide(self) -> None:
        assert self._key() != self._key(connection_id="conn-2")

    def test_different_provider_does_not_collide(self) -> None:
        assert self._key() != self._key(provider="nayax")

    def test_different_payload_does_not_collide(self) -> None:
        assert self._key() != self._key(payload_hash=content_hash(b"other"))

    def test_field_boundaries_cannot_be_shifted(self) -> None:
        """Concatenation without a separator would let these two collide."""
        left = idempotency_key(
            tenant_id="ab", connection_id="c", provider="p", payload_hash="h"
        )
        right = idempotency_key(
            tenant_id="a", connection_id="bc", provider="p", payload_hash="h"
        )
        assert left != right

    @pytest.mark.parametrize(
        "field", ["tenant_id", "connection_id", "provider", "payload_hash"]
    )
    def test_rejects_empty_field(self, field: str) -> None:
        with pytest.raises(ValueError):
            self._key(**{field: ""})

    @pytest.mark.parametrize(
        "field", ["tenant_id", "connection_id", "provider", "payload_hash"]
    )
    def test_rejects_nul_byte(self, field: str) -> None:
        with pytest.raises(ValueError):
            self._key(**{field: "a\x00b"})
