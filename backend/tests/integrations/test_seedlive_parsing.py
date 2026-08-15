"""Seed Live data-side proof: parse, classify, map, canonicalize.

Fixtures are sanitized and synthetic. They reproduce the *shape* measured from
the authentic 1,586-row export — column order, `$N.NN` amounts,
`MM/DD/YYYY HH:MM:SS AM` timestamps, `CODE($N.NN)` detail components — with
invented values. No customer data is committed.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from integrations.cantaloupe.canonicalize import (
    DEVICE_ENTITY_TYPE,
    LINE_ITEM_CODE_ENTITY_TYPE,
    PaymentMethod,
    ProviderEventClass,
    TransactionType,
    canonicalize,
    classify_trans_type,
)
from integrations.cantaloupe.schemas import (
    SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1,
    TRANSACTIONS_IN_PAYMENT_HEADER,
)
from integrations.cantaloupe.transactions import (
    TransactionParseError,
    UnsupportedSchema,
    parse_details,
    parse_money,
    parse_observed_datetime,
    parse_transactions_csv,
)
from integrations.identities import (
    CanonicalEntityType,
    ExternalIdentity,
    MappingState,
    unresolved_identity,
)

from .conftest import CONNECTION_ID, ORG_ID, OTHER_ORG_ID

OTHER_CONNECTION_ID = "44444444-4444-4444-4444-444444444444"

DEVICE_A = "VM000000001"
DEVICE_UNKNOWN = "VM000000999"
CODE_A = "0141"
CODE_B = "0207"
FEE_LABEL = "SVC-CHRG SURCHRG"

HEADER = ",".join(TRANSACTIONS_IN_PAYMENT_HEADER)


def row(
    *,
    trans_type="Credit (Apple Pay EMV)",
    amount="$2.50",
    device=DEVICE_A,
    tran="100001",
    details=f"{CODE_A}($2.50)",
    date="09/26/2025 10:15:00 AM",
    settle="Settled",
    ap_code="A1B2",
) -> str:
    return (
        f"REF1,RG1,{trans_type},{settle},{tran},{device},T00000001,"
        f"SITE ONE,AST,,{date},Visa,{amount},{ap_code},\"{details}\",7"
    )


def csv_bytes(*rows: str) -> bytes:
    return (HEADER + "\r\n" + "\r\n".join(rows) + "\r\n").encode("utf-8")


class InMemoryIdentityStore:
    """Task 2 store contract, in memory. No database."""

    def __init__(self, *entries: ExternalIdentity) -> None:
        self._by_key = {(e.org_id, *e.key): e for e in entries}

    def find(self, *, org_id, connection_id, entity_type, external_id):
        return self._by_key.get((org_id, connection_id, entity_type.lower(), external_id))

    def upsert(self, identity):
        self._by_key[(identity.org_id, *identity.key)] = identity
        return identity

    def counts_by_state(self, *, org_id):
        counts = {s: 0 for s in MappingState}
        for e in self._by_key.values():
            if e.org_id == org_id:
                counts[e.mapping_state] += 1
        return counts


def resolved_device(machine_id="smartvend-machine-1", device=DEVICE_A, **kw):
    return unresolved_identity(
        org_id=kw.get("org_id", ORG_ID),
        connection_id=kw.get("connection_id", CONNECTION_ID),
        entity_type=DEVICE_ENTITY_TYPE,
        external_id=device,
        canonical_entity_type=CanonicalEntityType.MACHINE,
    ).resolve_to(machine_id)


# --------------------------------------------------------------------------
# Subtask 7 — parsing
# --------------------------------------------------------------------------

class TestMoneyAndDate:
    @pytest.mark.parametrize(
        "raw,expected",
        [("$2.50", "2.50"), ("-$2.50", "-2.50"), ("2.50", "2.50"), ("$1,234.56", "1234.56")],
    )
    def test_money_parses_with_sign_preserved(self, raw, expected) -> None:
        assert parse_money(raw) == Decimal(expected)

    @pytest.mark.parametrize("raw", ["", "   ", "abc", "$", None])
    def test_invalid_money_raises_never_defaults(self, raw) -> None:
        """A silently zeroed amount is a wrong financial record."""
        with pytest.raises(TransactionParseError):
            parse_money(raw)

    def test_observed_datetime_parses_naive(self) -> None:
        parsed = parse_observed_datetime("09/26/2025 10:15:00 AM")
        assert (parsed.year, parsed.month, parsed.day, parsed.hour) == (2025, 9, 26, 10)
        assert parsed.tzinfo is None, "no timezone may be invented"

    def test_pm_times_parse(self) -> None:
        assert parse_observed_datetime("09/26/2025 07:45:00 PM").hour == 19

    def test_bad_date_raises(self) -> None:
        with pytest.raises(TransactionParseError):
            parse_observed_datetime("2025-09-26T10:15:00Z")


class TestDetailsDecomposition:
    def test_single_component(self) -> None:
        (component,) = parse_details("0141($2.50)")
        assert component.code == "0141"
        assert component.quantity == 1
        assert component.unit_amount == Decimal("2.50")
        assert component.is_line_item is True

    def test_multiple_components(self) -> None:
        components = parse_details("0141($2.50), 0207($1.25)")
        assert [c.code for c in components] == ["0141", "0207"]

    def test_quantity_multiplier(self) -> None:
        (component,) = parse_details("0141(2 * $1.25)")
        assert component.quantity == 2
        assert component.extended_amount == Decimal("2.50")

    def test_fee_label_is_not_a_line_item(self) -> None:
        """The constant alphabetic label is a fee, not a vended line item."""
        components = parse_details(f"0141($2.50), {FEE_LABEL}($0.10)")
        items = [c for c in components if c.is_line_item]
        assert [c.code for c in items] == ["0141"]
        assert components[1].is_line_item is False

    def test_blank_details_is_empty(self) -> None:
        assert parse_details("") == ()

    def test_unparsable_component_raises(self) -> None:
        """Silently dropping part of a transaction is not acceptable."""
        with pytest.raises(TransactionParseError):
            parse_details("0141($2.50), garbage-without-amount")


class TestCsvParsing:
    def test_parses_a_known_schema_row(self) -> None:
        (record,) = parse_transactions_csv(csv_bytes(row()))
        assert record.tran_number == "100001"
        assert record.device == DEVICE_A
        assert record.amount == Decimal("2.50")
        assert record.trans_type == "Credit (Apple Pay EMV)"
        assert record.timezone_known is False
        assert record.date_raw == "09/26/2025 10:15:00 AM"

    def test_components_reconcile_to_amount(self) -> None:
        (record,) = parse_transactions_csv(
            csv_bytes(row(amount="$2.60", details=f"0141($2.50), {FEE_LABEL}($0.10)"))
        )
        assert record.components_total == Decimal("2.60")
        assert record.components_reconcile is True

    def test_unknown_schema_is_never_parsed(self) -> None:
        """The parser must not be selected for an unrecognised payload."""
        with pytest.raises(UnsupportedSchema):
            parse_transactions_csv(b"a,b,c\r\n1,2,3\r\n")

    def test_binary_payload_is_not_parsed(self) -> None:
        with pytest.raises(UnsupportedSchema):
            parse_transactions_csv(bytes(range(256)))

    def test_bad_amount_in_a_row_raises(self) -> None:
        with pytest.raises(TransactionParseError):
            parse_transactions_csv(csv_bytes(row(amount="")))


# --------------------------------------------------------------------------
# Trans Type classification
# --------------------------------------------------------------------------

class TestTransTypeClassification:
    @pytest.mark.parametrize(
        "trans_type,method",
        [
            ("Cash", PaymentMethod.CASH.value),
            ("Credit", PaymentMethod.CASHLESS.value),
            ("Credit (Apple Pay EMV)", PaymentMethod.CASHLESS.value),
            ("Credit (EMV Contactless)", PaymentMethod.CASHLESS.value),
            ("Credit (Apple Pay Cash EMV)", PaymentMethod.CASHLESS.value),
            ("Credit (Google Pay EMV)", PaymentMethod.CASHLESS.value),
        ],
    )
    def test_observed_sale_types(self, trans_type, method) -> None:
        assert classify_trans_type(trans_type) is ProviderEventClass.SALE
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row(trans_type=trans_type))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        assert draft.transaction_type is TransactionType.SALE
        assert draft.payment_method == method

    def test_refund_type(self) -> None:
        assert classify_trans_type("Refund") is ProviderEventClass.REFUND

    @pytest.mark.parametrize(
        "trans_type",
        ["Chargeback", "Adjustment", "Void", "Test", "", "Credit (Some New Wallet)"],
    )
    def test_unobserved_types_are_unsupported_not_sales(self, trans_type) -> None:
        """An allowlist, never a default. An unknown event must not inflate revenue."""
        assert classify_trans_type(trans_type) is ProviderEventClass.UNSUPPORTED

    def test_classification_is_case_insensitive(self) -> None:
        assert classify_trans_type("  cash  ") is ProviderEventClass.SALE


# --------------------------------------------------------------------------
# Canonical semantics
# --------------------------------------------------------------------------

class TestCanonicalTransaction:
    def test_sale_produces_positive_magnitude(self) -> None:
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row(amount="$2.50"))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        assert draft.transaction_type is TransactionType.SALE
        assert draft.total_amount == Decimal("2.50")

    def test_refund_negative_provider_amount_becomes_positive_magnitude(self) -> None:
        """ADR-0003 D3c: meaning from the type, magnitude from the value."""
        (draft,) = canonicalize(
            parse_transactions_csv(
                csv_bytes(row(trans_type="Refund", amount="-$2.50"))
            ),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        assert draft.transaction_type is TransactionType.REFUND
        assert draft.total_amount == Decimal("2.50")
        assert draft.total_amount > 0

    def test_unsupported_event_is_reported_not_converted(self) -> None:
        result = canonicalize(
            parse_transactions_csv(csv_bytes(row(trans_type="Chargeback"))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        )
        assert result.drafts == ()
        assert len(result.unsupported) == 1
        assert result.unsupported[0].trans_type == "Chargeback"

    def test_timezone_is_never_invented(self) -> None:
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        assert draft.timezone_known is False
        assert draft.occurred_at_naive.tzinfo is None
        assert draft.occurred_at_raw == "09/26/2025 10:15:00 AM"

    def test_org_id_comes_from_the_caller_not_the_payload(self) -> None:
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        assert draft.org_id == ORG_ID

    def test_negative_magnitude_is_rejected_by_the_draft(self) -> None:
        from integrations.cantaloupe.canonicalize import CanonicalTransactionDraft
        from datetime import datetime

        with pytest.raises(ValueError):
            CanonicalTransactionDraft(
                org_id=ORG_ID,
                transaction_type=TransactionType.REFUND,
                total_amount=Decimal("-1.00"),
                occurred_at_naive=datetime(2025, 9, 26),
                occurred_at_raw="",
                timezone_known=False,
            )

    def test_lines_reconcile_as_a_control_not_an_authority(self) -> None:
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row(amount="$2.50", details="0141($2.50)"))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        assert draft.lines_reconcile is True
        assert draft.total_amount == Decimal("2.50")


# --------------------------------------------------------------------------
# Subtask 8 — Device to Machine
# --------------------------------------------------------------------------

class TestDeviceToMachine:
    def test_known_device_resolves_to_a_machine(self) -> None:
        store = InMemoryIdentityStore(resolved_device())
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            identities=store,
        ).drafts

        assert draft.machine_resolved is True
        assert draft.machine_id == "smartvend-machine-1"

    def test_unknown_device_stays_unresolved_without_a_wrong_machine(self) -> None:
        store = InMemoryIdentityStore(resolved_device())
        result = canonicalize(
            parse_transactions_csv(csv_bytes(row(device=DEVICE_UNKNOWN))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            identities=store,
        )
        (draft,) = result.drafts

        assert draft.machine_id is None
        assert draft.machine_resolved is False
        # The transaction survived.
        assert draft.total_amount == Decimal("2.50")
        assert any(
            i.entity_type == DEVICE_ENTITY_TYPE
            and i.external_id == DEVICE_UNKNOWN
            and i.mapping_state is MappingState.UNRESOLVED
            for i in result.identities
        )

    def test_ambiguous_mapping_is_supported(self) -> None:
        ambiguous = unresolved_identity(
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            entity_type=DEVICE_ENTITY_TYPE,
            external_id=DEVICE_A,
            canonical_entity_type=CanonicalEntityType.MACHINE,
        ).mark_ambiguous()
        store = InMemoryIdentityStore(ambiguous)

        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            identities=store,
        ).drafts
        assert draft.machine_id is None

    def test_same_device_in_another_connection_does_not_collide(self) -> None:
        """A resolution under one connection must not leak into another."""
        store = InMemoryIdentityStore(resolved_device())
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=OTHER_ORG_ID,
            connection_id=OTHER_CONNECTION_ID,
            identities=store,
        ).drafts
        assert draft.machine_id is None

    def test_provider_identifier_never_becomes_the_machine_id(self) -> None:
        store = InMemoryIdentityStore(resolved_device())
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            identities=store,
        ).drafts
        assert draft.machine_id != DEVICE_A
        assert draft.provider_device_id == DEVICE_A

    def test_telemetry_device_id_is_not_repurposed_as_the_crosswalk(self) -> None:
        """The compatibility field stays out of the mapping path entirely."""
        import pathlib

        for module in ("canonicalize.py", "transactions.py"):
            source = (
                pathlib.Path(__file__).resolve().parents[2]
                / "integrations"
                / "cantaloupe"
                / module
            ).read_text(encoding="utf-8")
            assert "telemetry_device_id" not in source
            assert "external_code" not in source


# --------------------------------------------------------------------------
# Subtask 9 — selection to slot / product
# --------------------------------------------------------------------------

class TestSelectionMapping:
    def test_selection_codes_produce_unresolved_crosswalk_entries(self) -> None:
        """Selection meaning is NOT VERIFIED, so it must not be guessed."""
        result = canonicalize(
            parse_transactions_csv(csv_bytes(row(details=f"{CODE_A}($2.50)"))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        )
        selections = [
            i for i in result.identities if i.entity_type == LINE_ITEM_CODE_ENTITY_TYPE
        ]
        assert [i.external_id for i in selections] == [CODE_A]
        assert selections[0].mapping_state is MappingState.UNRESOLVED
        assert selections[0].canonical_entity_type is CanonicalEntityType.SLOT

    def test_unresolved_selection_does_not_lose_the_transaction(self) -> None:
        """The headline Task 9 property."""
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row(details=f"{CODE_A}($2.50)"))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts

        assert draft.total_amount == Decimal("2.50")
        assert draft.transaction_type is TransactionType.SALE
        assert len(draft.lines) == 1
        assert draft.lines[0].slot_id is None
        assert draft.lines[0].product_id is None
        assert draft.lines[0].is_enriched is False

    def test_no_synthetic_product_or_slot_is_fabricated(self) -> None:
        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts
        for line in draft.lines:
            assert line.slot_id is None
            assert line.product_id is None
            assert "unknown" not in str(line.slot_id).lower()

    def test_resolved_selection_enriches_the_line(self) -> None:
        """If evidence ever resolves a selection, the line carries it."""
        resolved = unresolved_identity(
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            entity_type=LINE_ITEM_CODE_ENTITY_TYPE,
            external_id=CODE_A,
            canonical_entity_type=CanonicalEntityType.SLOT,
        ).resolve_to("smartvend-slot-9")
        store = InMemoryIdentityStore(resolved)

        (draft,) = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            identities=store,
        ).drafts
        assert draft.lines[0].slot_id == "smartvend-slot-9"
        assert draft.lines[0].is_enriched is True

    def test_fee_component_never_becomes_a_selection_mapping(self) -> None:
        result = canonicalize(
            parse_transactions_csv(
                csv_bytes(row(amount="$2.60", details=f"{CODE_A}($2.50), {FEE_LABEL}($0.10)"))
            ),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        )
        selection_ids = {
            i.external_id
            for i in result.identities
            if i.entity_type == LINE_ITEM_CODE_ENTITY_TYPE
        }
        assert selection_ids == {CODE_A}
        assert FEE_LABEL not in selection_ids

    def test_ap_code_is_never_treated_as_a_selection(self) -> None:
        """Evidence showed AP Code is a card-processing artifact."""
        result = canonicalize(
            parse_transactions_csv(csv_bytes(row(ap_code="ZZ99"))),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        )
        assert "ZZ99" not in {i.external_id for i in result.identities}


# --------------------------------------------------------------------------
# End to end
# --------------------------------------------------------------------------

class TestEndToEndProof:
    def test_mixed_batch_produces_a_reportable_outcome(self) -> None:
        payload = csv_bytes(
            row(tran="1", device=DEVICE_A, amount="$2.50"),
            row(tran="2", device=DEVICE_UNKNOWN, amount="$1.25", details=f"{CODE_B}($1.25)"),
            row(tran="3", trans_type="Refund", amount="-$2.50"),
            row(tran="4", trans_type="Chargeback", amount="$5.00"),
        )
        store = InMemoryIdentityStore(resolved_device())
        result = canonicalize(
            parse_transactions_csv(payload),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            identities=store,
            source_artifact_id="artifact-1",
        )

        assert len(result.drafts) == 3          # chargeback excluded
        assert len(result.unsupported) == 1
        assert result.machines_resolved == 2
        assert result.machines_unresolved == 1
        assert {d.transaction_type for d in result.drafts} == {
            TransactionType.SALE,
            TransactionType.REFUND,
        }
        assert all(d.total_amount > 0 for d in result.drafts)
        # Every selection stayed unresolved, and nothing was lost for it.
        assert len(result.unresolved_identities) >= 2

    def test_header_line_gap_is_exactly_the_fee(self) -> None:
        """ADR-0003 anticipated fees as a reason lines differ from the header.

        Measured across the authentic export: no-fee rows reconcile exactly,
        and on fee rows `total_amount - lines_total` equals the fee exactly.
        Nothing is unexplained, and the header is never overwritten.
        """
        (draft,) = canonicalize(
            parse_transactions_csv(
                csv_bytes(
                    row(amount="$2.60", details=f"{CODE_A}($2.50), {FEE_LABEL}($0.10)")
                )
            ),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
        ).drafts

        assert draft.total_amount == Decimal("2.60")
        assert draft.lines_total == Decimal("2.50")
        assert draft.total_amount - draft.lines_total == Decimal("0.10")
        assert draft.lines_reconcile is False  # reported, never auto-corrected

    def test_identities_cite_the_source_artifact(self) -> None:
        result = canonicalize(
            parse_transactions_csv(csv_bytes(row())),
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            source_artifact_id="artifact-1",
        )
        assert all(i.source_artifact_id == "artifact-1" for i in result.identities)

    def test_schema_gate_is_enforced_before_any_parsing(self) -> None:
        with pytest.raises(UnsupportedSchema):
            parse_transactions_csv(
                b"Reference #,Wrong\r\n1,2\r\n",
                schema_id=SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1.replace("v1", "v9"),
            )
