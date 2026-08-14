"""The ingestion path: authentication, preservation, idempotency, tenancy."""

from __future__ import annotations

import pytest

from integrations.artifacts import ArtifactState, UNKNOWN_REPORT_TYPE
from integrations.authentication import (
    AuthenticationFailed,
    AuthenticationNotConfigured,
    UnverifiedProviderAuthenticator,
)
from integrations.cantaloupe.connector import (
    SINGLE_TRANSACTION_DATA_EXPORT,
    CantaloupeConnector,
)
from integrations.connections import (
    ConnectionNotAcceptingInbound,
    ConnectionStatus,
)
from integrations.hashing import content_hash
from integrations.inbound import EmptyPayload, InboundReportRequest
from integrations.ingest import ingest_report

from .conftest import (
    OTHER_ORG_ID,
    AcceptingAuthenticator,
    FakeArtifactStore,
    RejectingAuthenticator,
    make_connection,
)

PAYLOAD = b"TransactionId,Amount\r\n1,2.50\r\n"


def ingest(connection, store, *, payload=PAYLOAD, authenticator=None, hint=None):
    return ingest_report(
        InboundReportRequest(payload=payload, report_type_hint=hint),
        connection,
        connector=CantaloupeConnector(),
        authenticator=authenticator or AcceptingAuthenticator(),
        store=store,
    )


class TestArtifactCreation:
    def test_preserves_the_delivery(self, connection, store) -> None:
        result = ingest(connection, store)
        artifact = result.artifact

        assert result.duplicate is False
        assert artifact.state is ArtifactState.RECEIVED
        assert artifact.payload_hash == content_hash(PAYLOAD)
        assert artifact.size_bytes == len(PAYLOAD)
        assert artifact.storage_ref is not None
        assert store.payloads[artifact.id] == PAYLOAD

    def test_payload_bytes_are_stored_unmodified(self, connection, store) -> None:
        binary = bytes(range(256)) + b"\r\n"
        result = ingest(connection, store, payload=binary)
        assert store.payloads[result.artifact.id] == binary

    def test_tenant_comes_from_the_connection(self, connection, store) -> None:
        """Payload content must never determine the tenant.

        Tenant identity is carried concretely as `org_id`, per ADR-0002 D1a.
        """
        artifact = ingest(connection, store).artifact
        assert artifact.org_id == connection.org_id
        assert artifact.connection_id == connection.id

    def test_payload_content_cannot_influence_org_id(self, store) -> None:
        """A payload naming another organization changes nothing."""
        connection = make_connection()
        hostile = (
            b'{"org_id":"' + OTHER_ORG_ID.encode() + b'",'
            b'"tenant_id":"' + OTHER_ORG_ID.encode() + b'"}'
        )
        artifact = ingest(connection, store, payload=hostile).artifact
        assert artifact.org_id == connection.org_id
        assert artifact.org_id != OTHER_ORG_ID

    def test_unidentified_report_is_still_preserved(self, connection, store) -> None:
        artifact = ingest(connection, store).artifact
        assert artifact.report_type == UNKNOWN_REPORT_TYPE
        assert artifact.is_identified is False
        assert store.payloads[artifact.id] == PAYLOAD

    def test_report_name_hint_is_recorded_when_supplied(self, connection, store) -> None:
        """Provider-neutral: no adapter supplies a hint for Seed Live today."""
        artifact = ingest(
            connection, store, hint="Single Transaction Data Export"
        ).artifact
        assert artifact.report_type == SINGLE_TRANSACTION_DATA_EXPORT

    def test_received_at_is_timezone_aware(self, connection, store) -> None:
        assert ingest(connection, store).artifact.received_at.tzinfo is not None


class TestIdempotency:
    def test_replay_returns_the_original_artifact(self, connection, store) -> None:
        first = ingest(connection, store)
        second = ingest(connection, store)

        assert second.duplicate is True
        assert second.artifact.id == first.artifact.id
        assert len(store.by_key) == 1

    def test_replay_does_not_store_a_second_payload(self, connection, store) -> None:
        ingest(connection, store)
        ingest(connection, store)
        assert len(store.payloads) == 1

    def test_different_payload_is_a_new_artifact(self, connection, store) -> None:
        first = ingest(connection, store)
        second = ingest(connection, store, payload=b"different\r\n")

        assert second.duplicate is False
        assert second.artifact.id != first.artifact.id
        assert len(store.by_key) == 2

    def test_identical_payload_on_another_tenant_is_not_a_duplicate(self, store) -> None:
        """Two customers can legitimately receive the same report content."""
        a = make_connection()
        b = make_connection(
            connection_id="99999999-9999-9999-9999-999999999999",
            org_id=OTHER_ORG_ID,
        )
        first = ingest(a, store)
        second = ingest(b, store)

        assert second.duplicate is False
        assert second.artifact.org_id == OTHER_ORG_ID
        assert first.artifact.idempotency_key != second.artifact.idempotency_key


class TestAuthentication:
    def test_nothing_is_stored_when_authentication_is_not_configured(
        self, connection, store
    ) -> None:
        with pytest.raises(AuthenticationNotConfigured):
            ingest(
                connection,
                store,
                authenticator=UnverifiedProviderAuthenticator("cantaloupe"),
            )
        assert store.by_key == {}
        assert store.payloads == {}

    def test_nothing_is_stored_when_authentication_fails(
        self, connection, store
    ) -> None:
        """An unauthenticated caller cannot fill the artifact store."""
        with pytest.raises(AuthenticationFailed):
            ingest(connection, store, authenticator=RejectingAuthenticator())
        assert store.by_key == {}
        assert store.payloads == {}

    def test_the_default_authenticator_denies(self) -> None:
        authenticator = UnverifiedProviderAuthenticator("cantaloupe")
        with pytest.raises(AuthenticationNotConfigured):
            authenticator.verify(InboundReportRequest(payload=b"x"), make_connection())


class TestRejections:
    def test_empty_payload_is_rejected(self, connection, store) -> None:
        with pytest.raises(EmptyPayload):
            ingest(connection, store, payload=b"")
        assert store.by_key == {}

    def test_authentication_runs_before_payload_inspection(
        self, connection, store
    ) -> None:
        """An unauthenticated caller learns nothing about payload handling."""
        with pytest.raises(AuthenticationFailed):
            ingest(
                connection,
                store,
                payload=b"",
                authenticator=RejectingAuthenticator(),
            )

    @pytest.mark.parametrize(
        "status",
        [ConnectionStatus.PENDING, ConnectionStatus.DISABLED, ConnectionStatus.FAILED],
    )
    def test_connection_not_accepting_traffic_is_rejected(
        self, store, status: ConnectionStatus
    ) -> None:
        with pytest.raises(ConnectionNotAcceptingInbound):
            ingest(make_connection(status=status), store)
        assert store.by_key == {}

    def test_degraded_connection_still_accepts(self, store) -> None:
        """Degraded describes delivery health, not authorization."""
        result = ingest(make_connection(status=ConnectionStatus.DEGRADED), store)
        assert result.duplicate is False


class TestSecrets:
    def test_connection_repr_hides_the_credential_reference(self, connection) -> None:
        assert "secretstore" not in repr(connection)
        assert "credential_ref" not in repr(connection)

    def test_artifact_carries_no_payload_or_credential(self, connection, store) -> None:
        artifact = ingest(connection, store).artifact
        rendered = repr(artifact)
        assert "TransactionId" not in rendered
        assert "secretstore" not in rendered
