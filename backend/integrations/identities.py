"""The external identity crosswalk.

Providers name things with their own identifiers. VendSoft calls a machine one
thing, Seed Live calls it another, and SmartVend has its own primary key. This
module is where those three meet.

Two rules drive the whole design:

1. **A provider identifier never becomes a SmartVend primary key.** Provider
   identifiers are often small integers or short codes, unique only within one
   account. Adopting one as a key makes a future collision unfixable.
2. **An unmapped identifier is recorded, never discarded.** A model that can
   only say "mapped" forces a guess or a silent drop, and both corrupt data
   invisibly. An unresolved mapping is a visible work item.

Provider-specific vocabulary — terminal, coil, batch, AP code — lives in
`entity_type` and `external_id` as *values*. It never becomes a column, and it
never becomes a provider-specific table.

Nothing here persists. These are provider-neutral domain contracts, per
ADR-0002 D1c.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import Enum
from typing import Protocol
from uuid import uuid4

from integrations.inbound import utc_now


class MappingState(str, Enum):
    """How confident we are about what an external identifier refers to."""

    #: Seen, but we do not yet know which SmartVend record it is.
    UNRESOLVED = "unresolved"
    #: Confidently mapped to one specific canonical record.
    RESOLVED = "resolved"
    #: Could plausibly match more than one canonical record. Needs a decision.
    AMBIGUOUS = "ambiguous"


class CanonicalEntityType(str, Enum):
    """SmartVend entities a crosswalk entry may point at.

    Deliberately restricted to the canonical business entities approved in
    ADR-0003. The control plane may *reference* these; it never owns them.

    `Organization` is deliberately absent: organization ownership comes from
    the `IntegrationConnection`, never from a crosswalk entry.
    """

    #: VendSoft migration carries client site structure, so a provider location
    #: identifier must be resolvable to a canonical SmartVend Location.
    LOCATION = "location"
    MACHINE = "machine"
    PRODUCT = "product"
    SLOT = "slot"
    VEND_TRANSACTION = "vend_transaction"
    VEND_TRANSACTION_LINE = "vend_transaction_line"


def normalize_entity_type(value: str) -> str:
    """Normalize a provider's entity-type label.

    Free text on purpose. A provider calls things whatever it calls them, and
    forcing that vocabulary into an enum would mean either editing the enum for
    every provider or refusing to record identifiers we have genuinely seen.
    """
    if not isinstance(value, str) or not value.strip():
        raise ValueError("entity_type must be a non-empty string")
    return value.strip().lower()


@dataclass(frozen=True)
class ExternalIdentity:
    """One provider identifier and what, if anything, it maps to.

    Uniqueness is scoped by `(connection_id, entity_type, external_id)`. The
    connection carries both the organization and the provider, so one key
    prevents cross-tenant and cross-provider collisions at once.

    `org_id` is stored explicitly as well, even though the connection implies
    it. That redundancy is deliberate defense in depth: a query filtering on
    `org_id` must not depend on a join being written correctly.
    """

    id: str
    org_id: str
    connection_id: str
    #: Provider vocabulary, as a value. "machine", "terminal", "coil", "device".
    entity_type: str
    #: The provider's identifier, always text. Never a SmartVend key.
    external_id: str
    canonical_entity_type: CanonicalEntityType
    mapping_state: MappingState = MappingState.UNRESOLVED
    canonical_entity_id: str | None = None
    #: Which preserved artifact this identifier was observed in, when known.
    source_artifact_id: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        for name in ("id", "org_id", "connection_id", "external_id"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name} must be a non-empty string")

        object.__setattr__(self, "entity_type", normalize_entity_type(self.entity_type))

        # The invariant that makes the three states meaningful. Without it,
        # "unresolved with a canonical id set" is representable, and every
        # consumer has to guess whether to trust the id or the state.
        if self.mapping_state is MappingState.RESOLVED:
            if not self.canonical_entity_id:
                raise ValueError("a RESOLVED mapping requires canonical_entity_id")
        elif self.canonical_entity_id is not None:
            raise ValueError(
                f"a {self.mapping_state.value.upper()} mapping must not carry "
                "canonical_entity_id"
            )

    @property
    def key(self) -> tuple[str, str, str]:
        """The uniqueness scope: connection, entity type, external identifier."""
        return (self.connection_id, self.entity_type, self.external_id)

    @property
    def is_resolved(self) -> bool:
        return self.mapping_state is MappingState.RESOLVED

    def resolve_to(
        self, canonical_entity_id: str, *, now: datetime | None = None
    ) -> "ExternalIdentity":
        """Return a RESOLVED copy pointing at a canonical record.

        Returns a new value rather than mutating, so a resolution is an
        explicit, auditable transition instead of a field assignment somewhere.
        """
        if not isinstance(canonical_entity_id, str) or not canonical_entity_id.strip():
            raise ValueError("canonical_entity_id must be a non-empty string")
        return replace(
            self,
            mapping_state=MappingState.RESOLVED,
            canonical_entity_id=canonical_entity_id,
            updated_at=now or utc_now(),
        )

    def mark_ambiguous(self, *, now: datetime | None = None) -> "ExternalIdentity":
        """Return an AMBIGUOUS copy, dropping any canonical association.

        Dropping the association is the point: an ambiguous mapping that still
        carries one candidate is indistinguishable from a resolved one.
        """
        return replace(
            self,
            mapping_state=MappingState.AMBIGUOUS,
            canonical_entity_id=None,
            updated_at=now or utc_now(),
        )


def unresolved_identity(
    *,
    org_id: str,
    connection_id: str,
    entity_type: str,
    external_id: str,
    canonical_entity_type: CanonicalEntityType,
    source_artifact_id: str | None = None,
    identity_id_factory=lambda: str(uuid4()),
) -> ExternalIdentity:
    """Record a provider identifier we have seen but cannot yet place.

    This is the normal first state for every external identifier. Seed Live's
    selection-to-product resolution is NOT VERIFIED, so for that provider it may
    also be the *only* reachable state until provider evidence arrives.
    """
    return ExternalIdentity(
        id=identity_id_factory(),
        org_id=org_id,
        connection_id=connection_id,
        entity_type=entity_type,
        external_id=external_id,
        canonical_entity_type=canonical_entity_type,
        mapping_state=MappingState.UNRESOLVED,
        source_artifact_id=source_artifact_id,
    )


class ExternalIdentityStore(Protocol):
    """Persists crosswalk entries.

    Defined now so the mapping model is testable before the storage decision is
    settled. Implementations must scope every lookup by organization as well as
    by the uniqueness key: ownership should not rest on callers remembering to
    pass the right connection.
    """

    def find(
        self, *, org_id: str, connection_id: str, entity_type: str, external_id: str
    ) -> ExternalIdentity | None:
        """Return the crosswalk entry for this key within this org, or None."""
        ...

    def upsert(self, identity: ExternalIdentity) -> ExternalIdentity:
        """Insert or update by `(connection_id, entity_type, external_id)`."""
        ...

    def counts_by_state(self, *, org_id: str) -> dict[MappingState, int]:
        """Mapped / unresolved / ambiguous totals for one organization."""
        ...
