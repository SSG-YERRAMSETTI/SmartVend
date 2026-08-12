"""The Cantaloupe / Seed Live connector.

One implementation, serving every customer connection. Customer-specific
configuration lives in the connection record, never here.

Scope note: identification is limited to what a payload can tell us without a
verified provider contract. Parsing is not implemented, because no report
schema has been captured from a real delivery.
"""

from __future__ import annotations

from integrations.artifacts import UNKNOWN_REPORT_TYPE
from integrations.connections import IntegrationConnection
from integrations.connector import ReportIdentification, ReportParsingNotVerified
from integrations.inbound import InboundReportRequest
from integrations.providers import Provider

#: Report types observed in the Seed Live Report Register. These names are
#: recognised identifiers, not verified schemas: knowing a report exists is not
#: the same as knowing the shape of its payload.
SINGLE_TRANSACTION_DATA_EXPORT = "single_transaction_data_export"
TRANSACTION_LINE_ITEM_DATA_EXPORT = "transaction_line_item_data_export"
DEX_FILE = "dex_file"
REFUND_REPORT = "refund_report"
DEVICE_REPORT = "device_report"
PAYMENT_RECONCILIATION_REPORT = "payment_reconciliation_report"

SUPPORTED_REPORT_TYPES = frozenset(
    {
        SINGLE_TRANSACTION_DATA_EXPORT,
        TRANSACTION_LINE_ITEM_DATA_EXPORT,
        DEX_FILE,
        REFUND_REPORT,
        DEVICE_REPORT,
        PAYMENT_RECONCILIATION_REPORT,
    }
)

#: Maps a report name, as it appears in the Seed Live Report Register, to our
#: identifier. Keys are lowercased and stripped of separators before lookup, so
#: "Single Transaction Data Export" and "single-transaction-data-export" both
#: resolve.
#:
#: The report names are verified. How, or whether, the provider conveys a name
#: with a delivery is not, so nothing supplies a hint today. This table exists
#: for the moment a real delivery gives us a verified source.
_REPORT_NAME_ALIASES: dict[str, str] = {
    "singletransactiondataexport": SINGLE_TRANSACTION_DATA_EXPORT,
    "transactionlineitemdataexport": TRANSACTION_LINE_ITEM_DATA_EXPORT,
    "dexfile": DEX_FILE,
    "dex": DEX_FILE,
}


def _normalise(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


class CantaloupeConnector:
    """Connector for Cantaloupe / Seed Live.

    Satisfies `integrations.connector.LiveProviderConnector`.
    """

    @property
    def provider(self) -> Provider:
        return Provider.CANTALOUPE

    def supported_report_types(self) -> frozenset[str]:
        return SUPPORTED_REPORT_TYPES

    def identify(
        self,
        request: InboundReportRequest,
        connection: IntegrationConnection,
    ) -> ReportIdentification:
        """Identify a delivery as far as the evidence allows.

        Today this always returns unknown for a real Seed Live delivery,
        because no verified source of a report type exists: the HTTP adapter
        supplies no hint, and content sniffing is deliberately not attempted
        since a CSV header guess would be an invented schema.

        When a hint is present it is mapped against the verified Report
        Register names, and the result is always marked unconfident. A hint is
        corroborating evidence, never truth.

        Never raises. An unidentified payload is still preserved.
        """
        hint = request.report_type_hint
        if hint:
            normalised = _normalise(hint)
            mapped = _REPORT_NAME_ALIASES.get(normalised)
            if mapped is not None:
                return ReportIdentification(report_type=mapped, confident=False)
            for known in SUPPORTED_REPORT_TYPES:
                if _normalise(known) == normalised:
                    return ReportIdentification(report_type=known, confident=False)
        return ReportIdentification(report_type=UNKNOWN_REPORT_TYPE, confident=False)

    def parse(
        self,
        request: InboundReportRequest,
        identification: ReportIdentification,
        connection: IntegrationConnection,
    ) -> object:
        """Not implemented. No Seed Live report schema has been verified.

        Always raises `ReportParsingNotVerified`. Writing a parser against an
        assumed CSV or JSON shape would silently produce wrong canonical data.
        """
        raise ReportParsingNotVerified(
            self.provider.value, identification.report_type
        )
