"""Cantaloupe / Seed Live inbound HTTP boundary.

    POST /integrations/cantaloupe/{connection_id}/reports

**This router is deliberately not registered in main.py.**

Seed Live's authentication contract has not been verified, so no authenticator
can be implemented. Registering the route would publish an endpoint that cannot
authenticate its callers. The route is complete and tested, and registration is
a one-line change once a verified authenticator exists. See
docs/integrations/CANTALOUPE_SEEDLIVE_INTEGRATION.md.

Two things this module deliberately does **not** do, because the provider
contract is unverified:

- It reads no report-type signal from the request. Whether Seed Live conveys a
  report type, and where, is unknown. `InboundReportRequest.report_type_hint`
  is left unset rather than wired to an invented header.
- It returns **200** for every accepted delivery. Whether Seed Live treats 202,
  or any other 2xx, as a successful transport response is unknown. Locking in
  202 would encode an assumption as a contract.

The endpoint is provider-specific by design. Seed Live never sees the canonical
SmartVend model.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from integrations.artifacts import ArtifactStore
from integrations.authentication import (
    AuthenticationFailed,
    AuthenticationNotConfigured,
    InboundAuthenticator,
    UnverifiedProviderAuthenticator,
)
from integrations.cantaloupe.connector import CantaloupeConnector
from integrations.connections import (
    ConnectionNotAcceptingInbound,
    ConnectionNotFound,
    ConnectionResolver,
    IntegrationConnection,
)
from integrations.inbound import (
    EmptyPayload,
    InboundReportRequest,
    PayloadTooLarge,
    utc_now,
)
from integrations.ingest import ingest_report
from integrations.providers import Provider

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/integrations/cantaloupe", tags=["integrations"])

#: Upper bound on a single delivery. Seed Live's real report sizes are not
#: known, so this is a conservative guard against unbounded reads rather than a
#: number derived from the provider contract. Revisit with real payloads.
MAX_PAYLOAD_BYTES = 25 * 1024 * 1024

#: Every rejection that occurs before the caller is authenticated returns this
#: one response. An unauthenticated caller must not be able to tell an unknown
#: connection identifier from a real one, so "not found", "wrong provider",
#: "body too large", and "authentication failed" are indistinguishable from
#: outside. The real reason is logged internally.
UNATTRIBUTABLE_STATUS = status.HTTP_404_NOT_FOUND
UNATTRIBUTABLE_DETAIL = "Request could not be accepted."


class ReportAcceptedResponse(BaseModel):
    """Acknowledgement of a preserved delivery.

    Carries the minimum useful to the caller: that we accepted it, a handle for
    support correlation, and whether it was a replay. No payload content, no
    credential material, no internal identifiers such as the idempotency key,
    and no report classification.
    """

    status: str = "accepted"
    artifact_id: str
    replay: bool


def get_connection_resolver() -> ConnectionResolver:
    """Provide the connection resolver.

    No persistent implementation exists yet: the artifact and connection schema
    requires coordination with the application consolidation workstream. Tests
    override this dependency.
    """
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Integration endpoint is not configured.",
    )


def get_artifact_store() -> ArtifactStore:
    """Provide the raw artifact store. Not yet implemented; see above."""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Integration endpoint is not configured.",
    )


def get_inbound_authenticator() -> InboundAuthenticator:
    """Provide the inbound authenticator.

    Deny-by-default until the Seed Live contract is verified. Selection is
    provider-level today; once connections carry credential configuration this
    becomes per-connection, which is why connection resolution happens before
    authentication.
    """
    return UnverifiedProviderAuthenticator(Provider.CANTALOUPE.value)


async def read_limited_body(request: Request, limit: int = MAX_PAYLOAD_BYTES) -> bytes:
    """Read the request body, refusing anything over the limit.

    Streams and stops at the limit rather than calling `.body()`, so an
    oversized delivery cannot be buffered into memory in full before being
    rejected.
    """
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            raise PayloadTooLarge(limit)
        chunks.append(chunk)
    return b"".join(chunks)


def _reject_unattributable(reason: str, connection_id: str) -> HTTPException:
    """Log the real reason, return the one public response.

    Operational diagnostics stay internal. The connection identifier is logged
    because it arrived in the URL and is needed to debug a misconfigured
    transport; tenant identity is never logged here, because at this point the
    caller is not authenticated and may have no relationship to any tenant.
    """
    logger.warning(
        "cantaloupe inbound rejected: reason=%s connection_id=%s",
        reason,
        connection_id,
    )
    return HTTPException(
        status_code=UNATTRIBUTABLE_STATUS, detail=UNATTRIBUTABLE_DETAIL
    )


@router.post(
    "/{connection_id}/reports",
    response_model=ReportAcceptedResponse,
    status_code=status.HTTP_200_OK,
    summary="Receive a Seed Live report delivery",
)
async def receive_report(
    connection_id: str,
    request: Request,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
    store: ArtifactStore = Depends(get_artifact_store),
    authenticator: InboundAuthenticator = Depends(get_inbound_authenticator),
) -> ReportAcceptedResponse:
    """Preserve one Seed Live delivery as raw evidence.

    Returns 200 for both a newly preserved delivery and a recognised replay, so
    a provider retry is safe. Parsing happens later, out of this path.
    """
    # Resolved before the body is read, so an unknown connection costs nothing,
    # and before authentication, because credential configuration will be
    # per-connection once connections are persisted.
    connection: IntegrationConnection | None
    try:
        connection = resolver.resolve(connection_id, provider=Provider.CANTALOUPE)
    except ConnectionNotFound:
        connection = None

    if connection is None:
        raise _reject_unattributable("connection_not_found", connection_id)

    try:
        payload = await read_limited_body(request)
    except PayloadTooLarge:
        # Not 413: an oversized body from an unauthenticated caller must look
        # the same as an unknown connection, or the size limit becomes an
        # oracle for which connection identifiers are real.
        raise _reject_unattributable("payload_too_large", connection_id) from None

    inbound = InboundReportRequest(
        payload=payload,
        content_type=request.headers.get("content-type"),
        headers=dict(request.headers),
        received_at=utc_now(),
    )

    try:
        result = ingest_report(
            inbound,
            connection,
            connector=CantaloupeConnector(),
            authenticator=authenticator,
            store=store,
        )
    except AuthenticationNotConfigured as exc:
        # Not a client error, and independent of whether the connection exists,
        # so this leaks nothing: the endpoint is not serving at all.
        logger.warning(
            "cantaloupe inbound unavailable: authenticator not configured "
            "(connection_id=%s)",
            connection_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integration endpoint is not configured.",
        ) from exc
    except AuthenticationFailed:
        raise _reject_unattributable("authentication_failed", connection_id) from None
    except ConnectionNotAcceptingInbound as exc:
        # Post-authentication, so revealing connection state is safe and useful.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integration connection is not accepting inbound traffic.",
        ) from exc
    except EmptyPayload as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload is empty.",
        ) from exc

    logger.info(
        "cantaloupe report %s: artifact=%s connection=%s tenant=%s type=%s bytes=%d",
        "replayed" if result.duplicate else "received",
        result.artifact.id,
        connection_id,
        result.artifact.tenant_id,
        result.artifact.report_type,
        result.artifact.size_bytes,
    )

    return ReportAcceptedResponse(
        artifact_id=result.artifact.id,
        replay=result.duplicate,
    )
