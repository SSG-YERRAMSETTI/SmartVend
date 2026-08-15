"""Cross-cutting control-plane guarantees: ownership, evidence, replay.

These are the Task 2 properties that span more than one model, and the ones a
future refactor is most likely to break quietly.
"""

from __future__ import annotations

import pytest

from integrations.artifacts import RawReportArtifact
from integrations.hashing import content_hash, idempotency_key
from integrations.identities import CanonicalEntityType, unresolved_identity
from integrations.inbound import (
    SENSITIVE_HEADERS,
    InboundReportRequest,
    filter_headers,
)
from integrations.ingest import ingest_report
from integrations.providers import Provider

from .conftest import (
    CONNECTION_ID,
    ORG_ID,
    OTHER_ORG_ID,
    AcceptingAuthenticator,
    FakeArtifactStore,
    make_connection,
)
from .test_cantaloupe_routes import PAYLOAD

OTHER_CONNECTION_ID = "44444444-4444-4444-4444-444444444444"


def ingest(connection, store, *, payload=PAYLOAD):
    from integrations.cantaloupe.connector import CantaloupeConnector

    return ingest_report(
        InboundReportRequest(payload=payload),
        connection,
        connector=CantaloupeConnector(),
        authenticator=AcceptingAuthenticator(),
        store=store,
    )


class TestConnectionOwnership:
    def test_connection_belongs_to_exactly_one_org(self) -> None:
        assert make_connection().org_id == ORG_ID

    def test_one_org_may_hold_several_connections_to_one_provider(self) -> None:
        """Two Seed Live accounts under one operator is a real configuration."""
        a = make_connection()
        b = make_connection(connection_id=OTHER_CONNECTION_ID)

        assert a.org_id == b.org_id
        assert a.provider is b.provider
        assert a.id != b.id

    def test_same_provider_serves_independent_orgs(self) -> None:
        a = make_connection()
        b = make_connection(connection_id=OTHER_CONNECTION_ID, org_id=OTHER_ORG_ID)

        assert a.provider is b.provider
        assert a.org_id != b.org_id

    def test_credential_value_never_lives_on_the_connection(self) -> None:
        connection = make_connection()
        assert not hasattr(connection, "password")
        assert not hasattr(connection, "secret")
        assert connection.credential_ref is not None
        assert "secretstore://" in connection.credential_ref

    def test_connection_repr_cannot_leak_the_credential_reference(self) -> None:
        assert "secretstore://" not in repr(make_connection())

    def test_provider_config_lives_in_a_bounded_structure(self) -> None:
        """Provider specifics go in `config`, not in provider-specific tables."""
        connection = make_connection()
        assert isinstance(connection.config, dict)


class TestOrgIdIsNeverPayloadDerived:
    def test_payload_naming_another_org_changes_nothing(self) -> None:
        store = FakeArtifactStore()
        hostile = b'{"org_id":"' + OTHER_ORG_ID.encode() + b'","organization":"other"}'

        artifact = ingest(make_connection(), store, payload=hostile).artifact

        assert artifact.org_id == ORG_ID
        assert artifact.org_id != OTHER_ORG_ID

    def test_external_identity_org_comes_from_context_not_payload(self) -> None:
        identity = unresolved_identity(
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            entity_type="machine",
            external_id="M-014",
            canonical_entity_type=CanonicalEntityType.MACHINE,
        )
        assert identity.org_id == ORG_ID


class TestArtifactEvidence:
    def test_content_hash_is_exact_and_stable(self) -> None:
        import hashlib

        assert content_hash(PAYLOAD) == hashlib.sha256(PAYLOAD).hexdigest()
        assert content_hash(PAYLOAD) == content_hash(PAYLOAD)

    def test_raw_bytes_are_preserved_unmodified(self) -> None:
        store = FakeArtifactStore()
        binary = bytes(range(256)) + b"\r\n"
        result = ingest(make_connection(), store, payload=binary)
        assert store.payloads[result.artifact.id] == binary

    def test_authorization_is_never_stored_in_artifact_metadata(self) -> None:
        store = FakeArtifactStore()
        from integrations.cantaloupe.connector import CantaloupeConnector

        result = ingest_report(
            InboundReportRequest(
                payload=PAYLOAD,
                headers={
                    "Authorization": "Basic DO-NOT-STORE",
                    "X-Api-Key": "DO-NOT-STORE",
                    "Cookie": "DO-NOT-STORE",
                    "Content-Type": "text/csv",
                },
            ),
            make_connection(),
            connector=CantaloupeConnector(),
            authenticator=AcceptingAuthenticator(),
            store=store,
        )

        metadata = result.artifact.transport_metadata
        assert "DO-NOT-STORE" not in str(metadata)
        for header in SENSITIVE_HEADERS:
            assert header not in metadata
        assert metadata.get("content-type") == "text/csv"

    def test_header_filter_drops_anything_not_allowlisted(self) -> None:
        """Unassessed headers are dropped, not redacted."""
        filtered = filter_headers({"X-Unknown-Provider-Header": "value"})
        assert filtered == {}

    def test_artifact_is_owned_by_one_org_and_one_connection(self) -> None:
        store = FakeArtifactStore()
        artifact = ingest(make_connection(), store).artifact
        assert artifact.org_id == ORG_ID
        assert artifact.connection_id == CONNECTION_ID


class TestDuplicateAndReplay:
    def test_same_artifact_on_same_connection_is_a_replay(self) -> None:
        store = FakeArtifactStore()
        connection = make_connection()

        first = ingest(connection, store)
        second = ingest(connection, store)

        assert second.duplicate is True
        assert second.artifact.id == first.artifact.id
        assert len(store.payloads) == 1

    def test_same_bytes_under_a_different_org_cannot_collide(self) -> None:
        """Two operators may legitimately receive identical report content."""
        store = FakeArtifactStore()
        a = make_connection()
        b = make_connection(connection_id=OTHER_CONNECTION_ID, org_id=OTHER_ORG_ID)

        first = ingest(a, store)
        second = ingest(b, store)

        assert second.duplicate is False
        assert first.artifact.idempotency_key != second.artifact.idempotency_key
        assert second.artifact.org_id == OTHER_ORG_ID

    def test_same_bytes_under_a_different_connection_cannot_collide(self) -> None:
        store = FakeArtifactStore()
        a = make_connection()
        b = make_connection(connection_id=OTHER_CONNECTION_ID)

        first = ingest(a, store)
        second = ingest(b, store)

        assert second.duplicate is False
        assert first.artifact.idempotency_key != second.artifact.idempotency_key

    def test_artifact_equality_is_not_transaction_identity(self) -> None:
        """Level A is not level C. Same bytes says nothing about which
        business transactions are inside them."""
        payload_hash = content_hash(PAYLOAD)
        key = idempotency_key(
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            provider=Provider.CANTALOUPE.value,
            payload_hash=payload_hash,
        )
        assert key != payload_hash

    def test_different_content_is_a_new_artifact(self) -> None:
        store = FakeArtifactStore()
        connection = make_connection()

        first = ingest(connection, store)
        second = ingest(connection, store, payload=b"different\r\n")

        assert second.duplicate is False
        assert second.artifact.id != first.artifact.id


class TestControlPlaneDoesNotDuplicateCanonicalEntities:
    def test_no_provider_specific_business_models_exist(self) -> None:
        """No SeedLiveMachine, VendSoftMachine, NayaxProduct, and so on."""
        import ast
        import pathlib

        from .test_cantaloupe_routes import BACKEND_DIR

        forbidden = ("machine", "product", "slot", "location", "sale", "transaction")
        offenders = []
        for path in sorted((BACKEND_DIR / "integrations").rglob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if not isinstance(node, ast.ClassDef):
                    continue
                lowered = node.name.lower()
                # A control-plane class may *reference* canonical entities, so
                # only flag names that look like an owned business model.
                for term in forbidden:
                    if lowered.endswith(term) and "canonical" not in lowered:
                        offenders.append(f"{path.name}:{node.name}")
        assert offenders == []

    def test_artifact_carries_no_canonical_business_fields(self) -> None:
        fields = RawReportArtifact.__dataclass_fields__
        for forbidden in ("machine_id", "product_id", "slot_id", "location_id"):
            assert forbidden not in fields

    @pytest.mark.parametrize(
        "canonical", [t.value for t in CanonicalEntityType]
    )
    def test_crosswalk_references_canonical_entities_by_id_only(
        self, canonical: str
    ) -> None:
        identity = unresolved_identity(
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            entity_type="thing",
            external_id="X-1",
            canonical_entity_type=CanonicalEntityType(canonical),
        ).resolve_to("canonical-record-1")

        # A reference, not an owned copy: an id and a type, nothing more.
        assert identity.canonical_entity_id == "canonical-record-1"
        assert identity.canonical_entity_type.value == canonical
