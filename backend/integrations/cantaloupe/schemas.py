"""Deterministic schema identification for authentic Seed Live evidence.

Scope, stated precisely because it is easy to overclaim: this module answers
one question about a preserved artifact —

    "Is this the Transactions in Payment CSV shape we have actually seen?"

It does **not** parse business records. It does not establish how a real
generated HTTP report is framed, named, compressed, or versioned by the
provider. None of that has ever been observed. See
`docs/integrations/CANTALOUPE_SEEDLIVE_INTEGRATION.md` §14.

## What "v1" means

`SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1` is **SmartVend's** identifier for
**our** parser contract against the column layout we observed. Cantaloupe does
not call this schema "v1" and has published no version for it. The suffix
versions *our* understanding, so that when a second layout appears we can add
`_v2` without redefining what v1 meant.

## Why header evidence, and only header evidence

Identification reads the header line and nothing else. It never inspects data
values, never depends on customer-specific identifiers, and never uses the
filename. A filename may travel with a delivery as metadata, but a caller
controls it, so treating it as proof of schema would let a delivery name itself
into a parser.

Recognition requires the **exact column set in the exact observed order**. A
reordered or extended header returns UNKNOWN. That is deliberate: a partial
match is exactly the situation where a parser would silently read the wrong
column, and preserving an unparsed artifact is always recoverable while
misparsed data is not.
"""

from __future__ import annotations

import csv
import io

from integrations.connector import UNKNOWN_SCHEMA

#: SmartVend's identifier for the observed Transactions in Payment CSV layout.
#: Ours, not the provider's. See the module docstring.
SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1 = "seedlive_transactions_in_payment_csv_v1"

__all__ = [
    "SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1",
    "TRANSACTIONS_IN_PAYMENT",
    "TRANSACTIONS_IN_PAYMENT_HEADER",
    "UNKNOWN_SCHEMA",
    "PARSABLE_SCHEMAS",
    "SCHEMA_REPORT_TYPES",
    "identify_schema",
    "read_header_columns",
]

#: Report type for the historical export, in the same style as the Report
#: Register identifiers in `connector.py`.
TRANSACTIONS_IN_PAYMENT = "transactions_in_payment"

#: The exact header, in the exact order, of the authentic Seed Live export
#: "Transactions in Payment #<n>.csv": 16 columns, 1,586 data rows in the
#: sample. Transcribed from the real file; no column was inferred or invented.
TRANSACTIONS_IN_PAYMENT_HEADER: tuple[str, ...] = (
    "Reference #",
    "Reconcile Group",
    "Trans Type",
    "Settle State",
    "Tran #",
    "Device",
    "Terminal",
    "Location",
    "Asset #",
    "Client",
    "Date",
    "Card Type",
    "Amount",
    "AP Code",
    "Details",
    "Batch #",
)

#: Guard against a header line that is really a data row, or a runaway binary
#: blob being fed to the CSV reader.
_MAX_HEADER_BYTES = 4096


def _normalise_column(value: str) -> str:
    """Casefold and collapse whitespace. Punctuation is preserved.

    Tolerates incidental spacing differences without weakening the match:
    stripping punctuation would make "Tran #" and "Tran" indistinguishable.
    """
    return " ".join(value.split()).casefold()


_EXPECTED_NORMALISED = tuple(
    _normalise_column(c) for c in TRANSACTIONS_IN_PAYMENT_HEADER
)


def read_header_columns(payload: bytes) -> tuple[str, ...] | None:
    """Return the CSV header columns, or None if the bytes are not usable.

    Returns None rather than raising for empty input, non-UTF-8 bytes, or
    anything that does not decode to a parsable first line. An unreadable
    payload is an UNKNOWN artifact, never an error that loses evidence.
    """
    if not payload:
        return None

    head = bytes(payload[:_MAX_HEADER_BYTES])
    try:
        # utf-8-sig so a BOM, which the real export carries, does not become
        # part of the first column name.
        text = head.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None

    if "\x00" in text:
        # Binary. csv would happily tokenize it into nonsense.
        return None

    first_line = text.splitlines()[0] if text.splitlines() else ""
    if not first_line.strip():
        return None

    try:
        row = next(csv.reader(io.StringIO(first_line)))
    except (csv.Error, StopIteration):
        return None
    return tuple(row)


def identify_schema(payload: bytes) -> str:
    """Return a SmartVend schema identifier, or `UNKNOWN_SCHEMA`.

    Deterministic and side-effect free. Reads at most the first
    `_MAX_HEADER_BYTES` and never mutates the payload.
    """
    columns = read_header_columns(payload)
    if columns is None:
        return UNKNOWN_SCHEMA

    if tuple(_normalise_column(c) for c in columns) == _EXPECTED_NORMALISED:
        return SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1
    return UNKNOWN_SCHEMA


#: Schema identifier to the report type it belongs to. One entry today.
SCHEMA_REPORT_TYPES: dict[str, str] = {
    SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1: TRANSACTIONS_IN_PAYMENT,
}

#: Schemas a verified parser exists for. Deliberately **empty**: identifying a
#: shape is not the same as being able to turn it into canonical records, and
#: that is Task 7's job. Kept here so "recognised" and "parsable" can never be
#: silently conflated.
PARSABLE_SCHEMAS: frozenset[str] = frozenset()
