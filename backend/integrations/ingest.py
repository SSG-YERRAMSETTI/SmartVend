"""Inbound ingestion: the deterministic path from delivery to preserved artifact.

This is the whole boundary in one place, deliberately free of HTTP so it can be
tested without a server, a database, or a network.

Order of operations matters and is not arbitrary:

1. Authenticate. Nothing is inspected or stored before this succeeds, so an
   unauthenticated caller cannot fill the artifact store and cannot use the
   endpoint's responses to learn anything about the connection or the payload.
2. Check the connection accepts traffic. Deliberately after authentication:
   connection state is information, and only an authenticated caller may
   observe it.
3. Reject an empty payload.
4. Hash the exact bytes and derive the idempotency key.
5. Identify the report as far as evidence allows, never guessing.
6. Persist raw evidence before anything attempts to parse it.

Parsing is not part of this path. An artifact is preserved first and processed
afterwards, so a parser failure can never lose the delivery.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
from uuid import uuid4

from integrations.artifacts import (
    ArtifactState,
    ArtifactStore,
    DuplicateArtifact,
    RawReportArtifact,
)
from integrations.authentication import InboundAuthenticator
from integrations.connections import (
    ConnectionNotAcceptingInbound,
    IntegrationConnection,
)
from integrations.connector import LiveProviderConnector
from integrations.hashing import content_hash, idempotency_key
from integrations.inbound import EmptyPayload, InboundReportRequest, filter_headers


@dataclass(frozen=True)
class IngestResult:
    """Outcome of one delivery."""

    artifact: RawReportArtifact
    #: True when this delivery was recognised as a replay of one already held.
    duplicate: bool = False


def ingest_report(
    request: InboundReportRequest,
    connection: IntegrationConnection,
    *,
    connector: LiveProviderConnector,
    authenticator: InboundAuthenticator,
    store: ArtifactStore,
    artifact_id_factory: Callable[[], str] = lambda: str(uuid4()),
) -> IngestResult:
    """Authenticate, hash, identify, and preserve one provider delivery.

    Raises `EmptyPayload`, `ConnectionNotAcceptingInbound`,
    `AuthenticationFailed`, or `AuthenticationNotConfigured`. Returns an
    `IngestResult` on success, with `duplicate` set when the payload had
    already been received on this connection.

    Tenant identity is taken from the resolved connection, as `org_id`. Payload
    content never determines the tenant.
    """
    # Nothing is inspected or persisted before this line.
    authenticator.verify(request, connection)

    if not connection.accepts_inbound:
        raise ConnectionNotAcceptingInbound(connection.id, connection.status)

    if request.size_bytes == 0:
        raise EmptyPayload()

    payload_hash = content_hash(request.payload)
    key = idempotency_key(
        org_id=connection.org_id,
        connection_id=connection.id,
        provider=connection.provider.value,
        payload_hash=payload_hash,
    )

    identification = connector.identify(request, connection)

    artifact = RawReportArtifact(
        id=artifact_id_factory(),
        org_id=connection.org_id,
        connection_id=connection.id,
        provider=connection.provider,
        report_type=identification.report_type,
        report_version=identification.report_version,
        received_at=request.received_at,
        payload_hash=payload_hash,
        size_bytes=request.size_bytes,
        idempotency_key=key,
        state=ArtifactState.RECEIVED,
        content_type=request.content_type,
        source_filename=request.source_filename,
        transport_metadata=filter_headers(request.headers),
    )

    try:
        stored = store.store(artifact, request.payload)
    except DuplicateArtifact as duplicate:
        return IngestResult(artifact=duplicate.existing, duplicate=True)

    return IngestResult(artifact=stored, duplicate=False)
