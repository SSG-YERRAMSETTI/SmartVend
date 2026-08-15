"""The Cantaloupe / Seed Live connector.

One implementation, serving every customer connection. Customer-specific
configuration lives in the connection record, never here.

Scope note: identification is limited to what a payload can tell us without a
verified provider contract. Parsing is not implemented, because no report
schema has been captured from a real delivery.
"""

from __future__ import annotations

from integrations.artifacts import UNKNOWN_REPORT_TYPE
from integrations.cantaloupe.schemas import (
    SCHEMA_REPORT_TYPES,
    identify_schema,
)
from integrations.connections import IntegrationConnection
from integrations.connector import (
    UNKNOWN_SCHEMA,
    ReportIdentification,
    ReportParsingNotVerified,
)
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

        Order matters. **Payload structure outranks any hint**, because the
        header is evidence the payload carries about itself, while a hint is
        something a caller asserts. A recognised layout is therefore the only
        identification marked confident.

        If the layout is unrecognised we fall back to the hint, which can name
        a report type but can never establish a schema. Such a result stays
        unconfident with `schema_id` UNKNOWN, so it can never select a parser.

        Never raises. An unidentified payload is still preserved.
        """
        schema_id = identify_schema(request.payload)
        if schema_id != UNKNOWN_SCHEMA:
            return ReportIdentification(
                report_type=SCHEMA_REPORT_TYPES[schema_id],
                schema_id=schema_id,
                confident=True,
            )

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
        """Not implemented. Recognising a layout is not being able to parse it.

        Always raises `ReportParsingNotVerified`, including for a recognised
        schema. Identification (Task 6) establishes *what* an artifact is;
        turning rows into canonical records is Task 7 and is deliberately not
        started. `PARSABLE_SCHEMAS` is empty for exactly this reason.
        """
        raise ReportParsingNotVerified(
            self.provider.value, identification.report_type
        )
