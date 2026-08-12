"""Provider identity and the Cantaloupe connector boundary."""

from __future__ import annotations

import pytest

from integrations.artifacts import UNKNOWN_REPORT_TYPE
from integrations.cantaloupe.connector import (
    DEX_FILE,
    SINGLE_TRANSACTION_DATA_EXPORT,
    SUPPORTED_REPORT_TYPES,
    TRANSACTION_LINE_ITEM_DATA_EXPORT,
    CantaloupeConnector,
)
from integrations.connector import ReportParsingNotVerified
from integrations.inbound import InboundReportRequest
from integrations.providers import (
    PROVIDER_KINDS,
    Provider,
    ProviderKind,
    UnknownProvider,
)

from .conftest import make_connection


class TestProvider:
    def test_values_are_stable_strings(self) -> None:
        assert Provider.CANTALOUPE.value == "cantaloupe"
        assert Provider.NAYAX.value == "nayax"
        assert Provider.VENDSOFT.value == "vendsoft"

    def test_parse_is_case_and_whitespace_insensitive(self) -> None:
        assert Provider.parse("  Cantaloupe ") is Provider.CANTALOUPE

    def test_parse_rejects_unknown(self) -> None:
        with pytest.raises(UnknownProvider):
            Provider.parse("stripe")

    def test_cantaloupe_is_a_live_provider(self) -> None:
        assert PROVIDER_KINDS[Provider.CANTALOUPE] is ProviderKind.LIVE

    def test_vendsoft_is_historical(self) -> None:
        assert PROVIDER_KINDS[Provider.VENDSOFT] is ProviderKind.HISTORICAL

    def test_every_provider_has_a_kind(self) -> None:
        assert set(PROVIDER_KINDS) == set(Provider)


def request_with(hint: str | None = None) -> InboundReportRequest:
    return InboundReportRequest(payload=b"a,b\n1,2\n", report_type_hint=hint)


class TestCantaloupeConnector:
    def setup_method(self) -> None:
        self.connector = CantaloupeConnector()
        self.connection = make_connection()

    def test_serves_cantaloupe(self) -> None:
        assert self.connector.provider is Provider.CANTALOUPE

    def test_reports_its_supported_types(self) -> None:
        assert self.connector.supported_report_types() == SUPPORTED_REPORT_TYPES
        assert SINGLE_TRANSACTION_DATA_EXPORT in SUPPORTED_REPORT_TYPES
        assert TRANSACTION_LINE_ITEM_DATA_EXPORT in SUPPORTED_REPORT_TYPES
        assert DEX_FILE in SUPPORTED_REPORT_TYPES

    def test_unidentified_payload_is_unknown_not_an_error(self) -> None:
        """An unrecognised report is preserved, never rejected."""
        result = self.connector.identify(request_with(), self.connection)
        assert result.report_type == UNKNOWN_REPORT_TYPE
        assert result.is_known is False
        assert result.confident is False

    def test_does_not_sniff_content(self) -> None:
        """A CSV header guess would be an invented schema."""
        csv_like = InboundReportRequest(
            payload=b"TransactionId,Amount,DeviceSerial\n1,2.50,ABC\n"
        )
        assert self.connector.identify(csv_like, self.connection).report_type == (
            UNKNOWN_REPORT_TYPE
        )

    @pytest.mark.parametrize(
        "hint,expected",
        [
            ("Single Transaction Data Export", SINGLE_TRANSACTION_DATA_EXPORT),
            ("single-transaction-data-export", SINGLE_TRANSACTION_DATA_EXPORT),
            ("single_transaction_data_export", SINGLE_TRANSACTION_DATA_EXPORT),
            ("DEX File", DEX_FILE),
            ("dex", DEX_FILE),
            ("Transaction Line Item Data Export", TRANSACTION_LINE_ITEM_DATA_EXPORT),
        ],
    )
    def test_report_name_hint_is_mapped(self, hint: str, expected: str) -> None:
        result = self.connector.identify(request_with(hint), self.connection)
        assert result.report_type == expected

    def test_hinted_identification_is_never_confident(self) -> None:
        """A hint is corroborating evidence, never truth."""
        result = self.connector.identify(
            request_with("Single Transaction Data Export"), self.connection
        )
        assert result.confident is False

    def test_unrecognised_hint_is_unknown(self) -> None:
        result = self.connector.identify(request_with("Mystery Report"), self.connection)
        assert result.report_type == UNKNOWN_REPORT_TYPE

    def test_parsing_refuses_rather_than_guessing(self) -> None:
        identification = self.connector.identify(
            request_with("DEX File"), self.connection
        )
        with pytest.raises(ReportParsingNotVerified) as caught:
            self.connector.parse(request_with("DEX File"), identification, self.connection)
        assert "verified" in str(caught.value)
