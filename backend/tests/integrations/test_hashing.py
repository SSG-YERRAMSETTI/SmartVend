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
            "org_id": "org-a",
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
        """Tenant isolation, carried concretely by `org_id`."""
        assert self._key() != self._key(org_id="org-b")

    def test_different_connection_does_not_collide(self) -> None:
        assert self._key() != self._key(connection_id="conn-2")

    def test_different_provider_does_not_collide(self) -> None:
        assert self._key() != self._key(provider="nayax")

    def test_different_payload_does_not_collide(self) -> None:
        assert self._key() != self._key(payload_hash=content_hash(b"other"))

    def test_field_boundaries_cannot_be_shifted(self) -> None:
        """Concatenation without a separator would let these two collide."""
        left = idempotency_key(
            org_id="ab", connection_id="c", provider="p", payload_hash="h"
        )
        right = idempotency_key(
            org_id="a", connection_id="bc", provider="p", payload_hash="h"
        )
        assert left != right

    @pytest.mark.parametrize(
        "field", ["org_id", "connection_id", "provider", "payload_hash"]
    )
    def test_rejects_empty_field(self, field: str) -> None:
        with pytest.raises(ValueError):
            self._key(**{field: ""})

    @pytest.mark.parametrize(
        "field", ["org_id", "connection_id", "provider", "payload_hash"]
    )
    def test_rejects_nul_byte(self, field: str) -> None:
        with pytest.raises(ValueError):
            self._key(**{field: "a\x00b"})


class TestIdempotencyDerivationIsPinned:
    """Locks the digest so a refactor cannot silently change replay behaviour.

    These literals were computed from the implementation as it stood *before*
    the 2026-08-14 rename of the ownership parameter from `tenant_id` to
    `org_id`. They are reproduced here unchanged, so this class is the evidence
    that the rename was name-only: the ownership value, field order, NUL
    separator, UTF-8 encoding, and SHA-256 algorithm are all untouched.

    If a future change breaks these assertions, it has changed the identity of
    every artifact and must be treated as a data-migration decision, not a
    refactor.
    """

    #: Fixed inputs. Not real identifiers.
    PAYLOAD = b"pinned regression payload"
    ORG_ID = "11111111-1111-1111-1111-111111111111"
    CONNECTION_ID = "22222222-2222-2222-2222-222222222222"
    PROVIDER = "cantaloupe"

    #: Computed before the rename. Must never change.
    EXPECTED_PAYLOAD_HASH = (
        "7eec29fc5b32746942647b35a6aa0e1fca554034c98b8795e55fd104303a697c"
    )
    EXPECTED_KEY = "6a99f982428ae8190e9501f0d913da161ee6449fa826e3033b773a8574a8fadc"

    def _key(self) -> str:
        return idempotency_key(
            org_id=self.ORG_ID,
            connection_id=self.CONNECTION_ID,
            provider=self.PROVIDER,
            payload_hash=self.EXPECTED_PAYLOAD_HASH,
        )

    def test_content_hash_is_pinned(self) -> None:
        assert content_hash(self.PAYLOAD) == self.EXPECTED_PAYLOAD_HASH

    def test_idempotency_key_is_pinned(self) -> None:
        assert self._key() == self.EXPECTED_KEY

    def test_rename_did_not_alter_the_digest(self) -> None:
        """The pre-rename inputs still produce the pre-rename digest.

        The values passed as `tenant_id` before the rename are the values
        passed as `org_id` after it. Same bytes in, same digest out.
        """
        pre_rename_values = (
            self.ORG_ID,  # was supplied as tenant_id
            self.CONNECTION_ID,
            self.PROVIDER,
            self.EXPECTED_PAYLOAD_HASH,
        )
        expected = hashlib.sha256(
            b"\x00".join(part.encode("utf-8") for part in pre_rename_values)
        ).hexdigest()

        assert expected == self.EXPECTED_KEY
        assert self._key() == expected

    def test_field_names_are_not_part_of_the_digest(self) -> None:
        """Why the rename was safe: only values are hashed."""
        assert b"org_id" not in b"\x00".join(
            part.encode("utf-8")
            for part in (
                self.ORG_ID,
                self.CONNECTION_ID,
                self.PROVIDER,
                self.EXPECTED_PAYLOAD_HASH,
            )
        )
        assert self._key() == self.EXPECTED_KEY

    def test_ownership_value_still_scopes_the_key(self) -> None:
        """The rename must not have detached ownership from the derivation."""
        other = idempotency_key(
            org_id="33333333-3333-3333-3333-333333333333",
            connection_id=self.CONNECTION_ID,
            provider=self.PROVIDER,
            payload_hash=self.EXPECTED_PAYLOAD_HASH,
        )
        assert other != self.EXPECTED_KEY
