"""Minimal schema identification, and safe UNKNOWN handling.

Task 6 proves an artifact can be *recognised*. It deliberately proves nothing
about turning rows into canonical records: that is Task 7.
"""

from __future__ import annotations

import pytest

from integrations.artifacts import UNKNOWN_REPORT_TYPE
from integrations.cantaloupe.connector import CantaloupeConnector
from integrations.cantaloupe.schemas import (
    PARSABLE_SCHEMAS,
    SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1,
    TRANSACTIONS_IN_PAYMENT,
    TRANSACTIONS_IN_PAYMENT_HEADER,
    identify_schema,
)
from integrations.connector import UNKNOWN_SCHEMA, ReportParsingNotVerified
from integrations.inbound import InboundReportRequest

from .conftest import AcceptingAuthenticator, FakeArtifactStore, make_connection

HEADER_LINE = ",".join(TRANSACTIONS_IN_PAYMENT_HEADER).encode("utf-8")

#: Header plus one row of entirely fabricated values. No real customer data
#: appears in this repository.
KNOWN_CSV = HEADER_LINE + b"\r\nX-1,RG,Cash,Settled,1,DEV,TERM,SITE,A1,C,01/01/2025 12:00:00 AM,,1.50,,AA,7\r\n"


def identify(payload: bytes, *, hint: str | None = None):
    return CantaloupeConnector().identify(
        InboundReportRequest(payload=payload, report_type_hint=hint),
        make_connection(),
    )


class TestKnownSchema:
    def test_exact_header_identifies_transactions_in_payment(self) -> None:
        assert identify_schema(KNOWN_CSV) == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1

    def test_header_alone_is_sufficient(self) -> None:
        """No data rows required: identification never reads values."""
        assert identify_schema(HEADER_LINE) == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1

    def test_identification_is_deterministic(self) -> None:
        assert identify_schema(KNOWN_CSV) == identify_schema(KNOWN_CSV)

    def test_utf8_bom_is_tolerated(self) -> None:
        """The authentic export carries a BOM."""
        assert (
            identify_schema(b"\xef\xbb\xbf" + KNOWN_CSV)
            == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1
        )

    @pytest.mark.parametrize("newline", [b"\r\n", b"\n"])
    def test_either_line_ending_identifies(self, newline: bytes) -> None:
        payload = HEADER_LINE + newline + b"a\r\n"
        assert identify_schema(payload) == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1

    def test_quoted_header_identifies(self) -> None:
        quoted = ",".join(f'"{c}"' for c in TRANSACTIONS_IN_PAYMENT_HEADER).encode()
        assert identify_schema(quoted) == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1

    def test_connector_reports_type_and_schema_confidently(self) -> None:
        result = identify(KNOWN_CSV)
        assert result.report_type == TRANSACTIONS_IN_PAYMENT
        assert result.schema_id == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1
        assert result.has_known_schema is True
        assert result.confident is True

    def test_provider_version_is_not_invented(self) -> None:
        """`report_version` is for a provider-declared version. None exists."""
        assert identify(KNOWN_CSV).report_version is None

    def test_schema_id_is_ours_not_the_providers(self) -> None:
        """The v1 suffix versions our parser contract, not a Cantaloupe release."""
        assert SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1.startswith("seedlive_")
        assert SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1.endswith("_v1")


class TestUnknownSchema:
    @pytest.mark.parametrize(
        "payload",
        [
            b"",
            b"TransactionId,Amount\r\n1,2.50\r\n",
            b"a,b,c\r\n1,2,3\r\n",
            b"not a csv at all",
            b"\x00\x01\x02\x03\xff\xfe",
            bytes(range(256)),
            b"\xff\xfe\x00T\x00e\x00s\x00t",
            b"{\"json\": true}",
        ],
    )
    def test_unrelated_payloads_are_unknown(self, payload: bytes) -> None:
        assert identify_schema(payload) == UNKNOWN_SCHEMA

    def test_missing_a_required_column_is_unknown(self) -> None:
        short = ",".join(TRANSACTIONS_IN_PAYMENT_HEADER[:-1]).encode()
        assert identify_schema(short) == UNKNOWN_SCHEMA

    def test_extra_column_is_unknown(self) -> None:
        extended = (",".join(TRANSACTIONS_IN_PAYMENT_HEADER) + ",Extra").encode()
        assert identify_schema(extended) == UNKNOWN_SCHEMA

    def test_reordered_columns_are_unknown(self) -> None:
        """A partial match is where a parser reads the wrong column."""
        cols = list(TRANSACTIONS_IN_PAYMENT_HEADER)
        cols[0], cols[1] = cols[1], cols[0]
        assert identify_schema(",".join(cols).encode()) == UNKNOWN_SCHEMA

    def test_renamed_column_is_unknown(self) -> None:
        cols = list(TRANSACTIONS_IN_PAYMENT_HEADER)
        cols[4] = "Transaction Number"
        assert identify_schema(",".join(cols).encode()) == UNKNOWN_SCHEMA

    def test_malformed_bytes_do_not_raise(self) -> None:
        """UNKNOWN, never an exception that could lose the artifact."""
        for payload in (b"\xc3\x28", b'"unclosed', b"\r\n\r\n"):
            assert identify_schema(payload) == UNKNOWN_SCHEMA

    def test_connector_returns_unknown_without_raising(self) -> None:
        result = identify(b"random bytes")
        assert result.report_type == UNKNOWN_REPORT_TYPE
        assert result.schema_id == UNKNOWN_SCHEMA
        assert result.has_known_schema is False


class TestIdentificationSafety:
    def test_filename_alone_cannot_cause_recognition(self) -> None:
        """A caller controls the filename; it must not name itself into a parser."""
        request = InboundReportRequest(
            payload=b"nothing like a seed live export",
            source_filename="Transactions in Payment #8801865.csv",
        )
        result = CantaloupeConnector().identify(request, make_connection())
        assert result.schema_id == UNKNOWN_SCHEMA

    def test_hint_alone_cannot_establish_a_schema(self) -> None:
        """A hint may name a report type. It can never assert a layout."""
        result = identify(b"unrecognised", hint="Single Transaction Data Export")
        assert result.report_type != UNKNOWN_REPORT_TYPE
        assert result.schema_id == UNKNOWN_SCHEMA
        assert result.confident is False

    def test_payload_structure_outranks_a_contradictory_hint(self) -> None:
        result = identify(KNOWN_CSV, hint="Dex File")
        assert result.schema_id == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1
        assert result.report_type == TRANSACTIONS_IN_PAYMENT

    def test_customer_values_are_not_required(self) -> None:
        """Identification must not depend on customer-specific data."""
        empty_values = HEADER_LINE + b"\r\n" + b",".join(b"" for _ in range(16))
        assert (
            identify_schema(empty_values) == SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1
        )

    def test_identification_does_not_mutate_the_payload(self) -> None:
        payload = bytearray(KNOWN_CSV)
        before = bytes(payload)
        identify_schema(bytes(payload))
        assert bytes(payload) == before


class TestPreservationIsIndependentOfIdentification:
    """The artifact must survive whether or not we recognise it."""

    def _ingest(self, payload: bytes):
        from integrations.ingest import ingest_report

        store = FakeArtifactStore()
        result = ingest_report(
            InboundReportRequest(payload=payload),
            make_connection(),
            connector=CantaloupeConnector(),
            authenticator=AcceptingAuthenticator(),
            store=store,
        )
        return result, store

    def test_unknown_payload_is_still_preserved_byte_exact(self) -> None:
        payload = bytes(range(256)) + b"\r\nnot a report\r\n"
        result, store = self._ingest(payload)

        assert store.payloads[result.artifact.id] == payload
        assert result.artifact.report_type == UNKNOWN_REPORT_TYPE
        assert result.artifact.is_identified is False

    def test_known_payload_is_preserved_and_typed(self) -> None:
        result, store = self._ingest(KNOWN_CSV)

        assert store.payloads[result.artifact.id] == KNOWN_CSV
        assert result.artifact.report_type == TRANSACTIONS_IN_PAYMENT
        assert result.artifact.is_identified is True

    def test_recognition_does_not_imply_a_parser_exists(self) -> None:
        """Task 6 recognises. Task 7 parses. They must not be conflated."""
        assert PARSABLE_SCHEMAS == frozenset()

        result, _ = self._ingest(KNOWN_CSV)
        with pytest.raises(ReportParsingNotVerified):
            CantaloupeConnector().parse(
                InboundReportRequest(payload=KNOWN_CSV),
                CantaloupeConnector().identify(
                    InboundReportRequest(payload=KNOWN_CSV), make_connection()
                ),
                make_connection(),
            )
