"""Integration connection records and their resolution.

One connector implementation serves many customers. The connection record is
what makes that possible: it carries the customer-specific configuration and
credential reference for one customer-provider relationship.

Tenant identity is resolved from the connection, never from payload content.
"tenant" is the architectural concept; `org_id` is SmartVend's concrete
ownership identifier for it, per ADR-0002 D1a.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol

from integrations.providers import Provider, ProviderKind


class ConnectionStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DEGRADED = "degraded"
    FAILED = "failed"
    DISABLED = "disabled"


@dataclass(frozen=True)
class IntegrationConnection:
    """One customer-provider relationship.

    `credential_ref` is a pointer into a secret store. A credential value is
    never held on this object, never logged, and never persisted in the
    database.
    """

    id: str
    #: Owning organization. The concrete representation of tenant identity;
    #: see ADR-0002 D1a. A string here rather than a UUID so this package stays
    #: free of database coupling; canonicalization belongs to the future
    #: repository adapter.
    org_id: str
    provider: Provider
    kind: ProviderKind
    status: ConnectionStatus
    display_name: str | None = None
    credential_ref: str | None = None
    config: dict[str, Any] = field(default_factory=dict)

    @property
    def accepts_inbound(self) -> bool:
        """Whether this connection may currently receive provider traffic.

        A degraded connection still accepts data; degraded describes delivery
        health, not authorization. Pending, failed, and disabled do not.
        """
        return self.status in (ConnectionStatus.ACTIVE, ConnectionStatus.DEGRADED)

    def __repr__(self) -> str:  # pragma: no cover - trivial
        # Explicit so a credential reference never reaches a traceback or log
        # through the default dataclass repr.
        return (
            f"IntegrationConnection(id={self.id!r}, org_id={self.org_id!r}, "
            f"provider={self.provider.value!r}, status={self.status.value!r})"
        )

    __str__ = __repr__


class ConnectionNotFound(LookupError):
    """No connection matches the identifier, or it is not visible."""

    def __init__(self, connection_id: str) -> None:
        super().__init__(f"integration connection not found: {connection_id}")
        self.connection_id = connection_id


class ConnectionNotAcceptingInbound(PermissionError):
    """The connection exists but is not in a state that accepts traffic."""

    def __init__(self, connection_id: str, status: ConnectionStatus) -> None:
        super().__init__(
            f"integration connection {connection_id} does not accept inbound "
            f"traffic in status {status.value}"
        )
        self.connection_id = connection_id
        self.status = status


class ConnectionResolver(Protocol):
    """Resolves a connection identifier to a connection record.

    Implementations back onto persistent storage. The interface exists now so
    the inbound boundary can be built and tested before the storage decision is
    settled with the parallel workstream.
    """

    def resolve(self, connection_id: str, *, provider: Provider) -> IntegrationConnection:
        """Return the connection, or raise `ConnectionNotFound`.

        Implementations must verify the connection belongs to the given
        provider, so a Cantaloupe endpoint can never act on a Nayax connection.
        """
        ...
