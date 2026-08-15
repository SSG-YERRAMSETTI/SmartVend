"""Transform Seed Live provider records into canonical transaction drafts.

This is where the provider boundary ends. Per ADR-0002 D1b, integration work
stops at canonical transformation and **does not write**: no canonical record is
created or persisted here. The output is a *draft* of what would be written
through the application write port once that port exists.

Three rules govern everything below.

**1. Provider event types are an allowlist, never a default.** Seed Live's
`Trans Type` column carries seven values in the authentic export. Six are vend
sales and one is a refund. Anything not on the list is `UNSUPPORTED` and is
reported, never quietly turned into a sale. A provider that later adds an
adjustment, chargeback or test event must not silently inflate revenue.

**2. Canonical meaning comes from the type, never the sign.** ADR-0003 D3c.
Seed Live supplies both: the single refund row is typed `Refund` *and* carries a
negative `Amount`. The canonical draft takes the type and stores a positive
magnitude, so no aggregate can be wrong merely because it forgot to check a sign.

**3. Nothing is fabricated to make coverage look complete.** An unresolved
device leaves `machine_id` None. An unresolved line item code leaves `slot_id`
and `product_id` None. No "Unknown Product", no synthetic line, no invented slot.

**On naming.** The four-character codes from `Details` are called
**line item codes**, not "selections". The financial reconciliation proves they
identify the items making up a transaction; it does **not** prove they are Seed
Live Coil Names, selection identifiers, or planogram positions. The canonical
target kind below is `SLOT`, which records where such a mapping would land *if*
evidence later supports it. While every entry is UNRESOLVED, no such claim is
being made.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum

from integrations.cantaloupe.transactions import SeedLiveTransactionRecord
from integrations.identities import (
    CanonicalEntityType,
    ExternalIdentity,
    ExternalIdentityStore,
    MappingState,
    unresolved_identity,
)

#: Crosswalk entity types, in provider-boundary vocabulary that claims only
#: what the evidence supports.
DEVICE_ENTITY_TYPE = "device"
LINE_ITEM_CODE_ENTITY_TYPE = "line_item_code"


class TransactionType(str, Enum):
    """Canonical transaction types, ADR-0003 D3b."""

    SALE = "SALE"
    REFUND = "REFUND"


class PaymentMethod(str, Enum):
    """Canonical payment method. The existing schema offers exactly these two."""

    CASH = "cash"
    CASHLESS = "cashless"


class ProviderEventClass(str, Enum):
    SALE = "sale"
    REFUND = "refund"
    #: Recognised as a provider event, but not appropriate for a canonical
    #: VendTransaction. Preserved and reported, never converted.
    UNSUPPORTED = "unsupported"


#: The six `Trans Type` values observed as vend sales, with their counts in the
#: authentic 1,586-row export. Transcribed, not guessed.
SALE_TRANS_TYPES: dict[str, str] = {
    "cash": PaymentMethod.CASH.value,                       # 288 rows
    "credit": PaymentMethod.CASHLESS.value,                 # 43
    "credit (apple pay emv)": PaymentMethod.CASHLESS.value,  # 726
    "credit (emv contactless)": PaymentMethod.CASHLESS.value,  # 444
    "credit (apple pay cash emv)": PaymentMethod.CASHLESS.value,  # 76
    "credit (google pay emv)": PaymentMethod.CASHLESS.value,  # 8
}

#: The one observed refund type. 1 row, also negative.
REFUND_TRANS_TYPES: frozenset[str] = frozenset({"refund"})


def classify_trans_type(trans_type: str) -> ProviderEventClass:
    """Classify a provider `Trans Type` against the observed allowlist.

    An unobserved value is UNSUPPORTED. That is the safe default: treating an
    unknown financial event as a sale would overstate revenue silently.
    """
    key = (trans_type or "").strip().casefold()
    if key in REFUND_TRANS_TYPES:
        return ProviderEventClass.REFUND
    if key in SALE_TRANS_TYPES:
        return ProviderEventClass.SALE
    return ProviderEventClass.UNSUPPORTED


def payment_method_for(trans_type: str) -> str | None:
    return SALE_TRANS_TYPES.get((trans_type or "").strip().casefold())


@dataclass(frozen=True)
class CanonicalLineDraft:
    """A proposed `VendTransactionLine`. Not persisted, not canonical yet.

    `slot_id` and `product_id` are None until the crosswalk resolves them.
    `provider_line_item_code` is carried for crosswalk creation only; it is
    **not** a canonical column and must not become one, per ADR-0003 D3e.
    """

    quantity: int
    unit_price: Decimal
    provider_line_item_code: str
    slot_id: str | None = None
    product_id: str | None = None

    @property
    def is_enriched(self) -> bool:
        return self.slot_id is not None or self.product_id is not None


@dataclass(frozen=True)
class CanonicalTransactionDraft:
    """A proposed `VendTransaction`, ADR-0003 D3b. Never written here.

    `machine_id` is None when the device is unresolved. `total_amount` is always
    a positive magnitude. `occurred_at_naive` has no timezone because the
    provider supplies none, and `occurred_at_raw` preserves what was supplied.
    """

    org_id: str
    transaction_type: TransactionType
    total_amount: Decimal
    occurred_at_naive: datetime
    occurred_at_raw: str
    timezone_known: bool
    machine_id: str | None = None
    payment_method: str | None = None
    lines: tuple[CanonicalLineDraft, ...] = ()
    #: Provider evidence, kept beside the draft rather than inside canonical
    #: fields, so provenance never leaks into the business model.
    provider_transaction_id: str = ""
    provider_device_id: str = ""

    def __post_init__(self) -> None:
        if self.total_amount < 0:
            raise ValueError(
                "total_amount must be a positive magnitude; canonical meaning "
                "comes from transaction_type, never from the sign"
            )

    @property
    def machine_resolved(self) -> bool:
        return self.machine_id is not None

    @property
    def lines_total(self) -> Decimal:
        return sum(
            (line.unit_price * line.quantity for line in self.lines), Decimal("0")
        )

    @property
    def lines_reconcile(self) -> bool:
        """Control check only. Lines never overwrite the header, ADR-0003 D3b."""
        return bool(self.lines) and self.lines_total == self.total_amount


@dataclass(frozen=True)
class UnsupportedProviderEvent:
    """A provider row deliberately not canonicalized."""

    row_number: int
    trans_type: str
    provider_transaction_id: str
    reason: str = "trans_type is not an observed vend sale or refund"


@dataclass(frozen=True)
class CanonicalizationResult:
    """Everything one artifact produced, including what did not map."""

    drafts: tuple[CanonicalTransactionDraft, ...] = ()
    unsupported: tuple[UnsupportedProviderEvent, ...] = ()
    identities: tuple[ExternalIdentity, ...] = ()

    @property
    def machines_resolved(self) -> int:
        return sum(1 for d in self.drafts if d.machine_resolved)

    @property
    def machines_unresolved(self) -> int:
        return sum(1 for d in self.drafts if not d.machine_resolved)

    @property
    def unresolved_identities(self) -> tuple[ExternalIdentity, ...]:
        return tuple(
            i for i in self.identities if i.mapping_state is MappingState.UNRESOLVED
        )


def canonicalize(
    records: tuple[SeedLiveTransactionRecord, ...],
    *,
    org_id: str,
    connection_id: str,
    identities: ExternalIdentityStore | None = None,
    source_artifact_id: str | None = None,
) -> CanonicalizationResult:
    """Transform provider records into canonical drafts plus crosswalk entries.

    `identities` resolves provider identifiers to canonical records. When it is
    absent, or a lookup misses, the corresponding association is left None and
    an UNRESOLVED crosswalk entry is emitted. **A transaction is never dropped
    because enrichment failed.**
    """
    drafts: list[CanonicalTransactionDraft] = []
    unsupported: list[UnsupportedProviderEvent] = []
    emitted: dict[tuple[str, str], ExternalIdentity] = {}

    def crosswalk(entity_type: str, external_id: str, canonical_type) -> ExternalIdentity:
        key = (entity_type, external_id)
        if key in emitted:
            return emitted[key]

        found = None
        if identities is not None:
            found = identities.find(
                org_id=org_id,
                connection_id=connection_id,
                entity_type=entity_type,
                external_id=external_id,
            )
        entry = found or unresolved_identity(
            org_id=org_id,
            connection_id=connection_id,
            entity_type=entity_type,
            external_id=external_id,
            canonical_entity_type=canonical_type,
            source_artifact_id=source_artifact_id,
        )
        emitted[key] = entry
        return entry

    for record in records:
        event = classify_trans_type(record.trans_type)
        if event is ProviderEventClass.UNSUPPORTED:
            unsupported.append(
                UnsupportedProviderEvent(
                    row_number=record.row_number,
                    trans_type=record.trans_type,
                    provider_transaction_id=record.tran_number,
                )
            )
            continue

        machine = (
            crosswalk(DEVICE_ENTITY_TYPE, record.device, CanonicalEntityType.MACHINE)
            if record.device
            else None
        )

        lines: list[CanonicalLineDraft] = []
        for component in record.line_item_components:
            line_item = crosswalk(
                LINE_ITEM_CODE_ENTITY_TYPE, component.code, CanonicalEntityType.SLOT
            )
            lines.append(
                CanonicalLineDraft(
                    quantity=component.quantity,
                    unit_price=component.unit_amount,
                    provider_line_item_code=component.code,
                    slot_id=(
                        line_item.canonical_entity_id if line_item.is_resolved else None
                    ),
                )
            )

        drafts.append(
            CanonicalTransactionDraft(
                org_id=org_id,
                transaction_type=(
                    TransactionType.REFUND
                    if event is ProviderEventClass.REFUND
                    else TransactionType.SALE
                ),
                # Magnitude, always. The provider's sign stays at the boundary.
                total_amount=abs(record.amount),
                occurred_at_naive=record.occurred_at_naive,
                occurred_at_raw=record.date_raw,
                timezone_known=record.timezone_known,
                machine_id=(
                    machine.canonical_entity_id
                    if machine is not None and machine.is_resolved
                    else None
                ),
                payment_method=payment_method_for(record.trans_type),
                lines=tuple(lines),
                provider_transaction_id=record.tran_number,
                provider_device_id=record.device,
            )
        )

    return CanonicalizationResult(
        drafts=tuple(drafts),
        unsupported=tuple(unsupported),
        identities=tuple(emitted.values()),
    )
