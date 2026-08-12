"""Fakes for the integration boundary.

Every external dependency is replaced here. No network, no database, no
provider credentials, no real payloads.
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from integrations.artifacts import DuplicateArtifact, RawReportArtifact
from integrations.authentication import AuthenticationFailed
from integrations.connections import (
    ConnectionNotFound,
    ConnectionStatus,
    IntegrationConnection,
)
from integrations.providers import Provider, ProviderKind

TENANT_ID = "11111111-1111-1111-1111-111111111111"
CONNECTION_ID = "22222222-2222-2222-2222-222222222222"
OTHER_TENANT_ID = "33333333-3333-3333-3333-333333333333"


def make_connection(
    *,
    connection_id: str = CONNECTION_ID,
    tenant_id: str = TENANT_ID,
    provider: Provider = Provider.CANTALOUPE,
    status: ConnectionStatus = ConnectionStatus.ACTIVE,
) -> IntegrationConnection:
    return IntegrationConnection(
        id=connection_id,
        tenant_id=tenant_id,
        provider=provider,
        kind=ProviderKind.LIVE,
        status=status,
        display_name="Test connection",
        credential_ref="secretstore://test/not-a-real-credential",
    )


class FakeArtifactStore:
    """In-memory artifact store enforcing idempotency."""

    def __init__(self) -> None:
        self.by_key: dict[str, RawReportArtifact] = {}
        self.payloads: dict[str, bytes] = {}

    def store(self, artifact: RawReportArtifact, payload: bytes) -> RawReportArtifact:
        existing = self.by_key.get(artifact.idempotency_key)
        if existing is not None:
            raise DuplicateArtifact(existing)
        stored = replace(artifact, storage_ref=f"memory://{artifact.id}")
        self.by_key[artifact.idempotency_key] = stored
        self.payloads[artifact.id] = payload
        return stored

    def find_by_idempotency_key(self, key: str) -> RawReportArtifact | None:
        return self.by_key.get(key)


class FakeConnectionResolver:
    """Resolves only the connections it was given, and checks the provider."""

    def __init__(self, *connections: IntegrationConnection) -> None:
        self.connections = {c.id: c for c in connections}

    def resolve(self, connection_id: str, *, provider: Provider) -> IntegrationConnection:
        connection = self.connections.get(connection_id)
        if connection is None or connection.provider is not provider:
            raise ConnectionNotFound(connection_id)
        return connection


class AcceptingAuthenticator:
    """Authenticates everything. Test double only.

    Deliberately named so it can never be mistaken for a real implementation.
    """

    def verify(self, request, connection) -> None:
        return None


class RejectingAuthenticator:
    """Rejects everything."""

    def verify(self, request, connection) -> None:
        raise AuthenticationFailed()


@pytest.fixture
def connection() -> IntegrationConnection:
    return make_connection()


@pytest.fixture
def store() -> FakeArtifactStore:
    return FakeArtifactStore()
