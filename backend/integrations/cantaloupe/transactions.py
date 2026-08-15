"""Parser for the authentic Seed Live "Transactions in Payment" CSV.

This is the **provider boundary**. It produces provider records that keep Seed
Live's own vocabulary and its own values, including the sign it supplies.
Nothing here is canonical, and nothing here is written anywhere.

Only `seedlive_transactions_in_payment_csv_v1` is parsed. An unrecognised
schema never reaches this module.

## What the evidence established

Measured across the real 1,586-row export, not assumed:

- `Amount` is always `$N.NN`, or `-$N.NN` for the single refund. No thousands
  separators appear, but they are handled anyway.
- `Date` is `MM/DD/YYYY HH:MM:SS AM|PM` and carries **no timezone** on any of
  the 1,586 rows. The parsed value is therefore naive, and the raw string is
  kept, so nothing downstream can mistake it for UTC.
- `Details` decomposes cleanly into `CODE($N.NN)` components separated by
  `, `, with an optional `N * ` multiplier. **All 2,730 components parsed, with
  zero failures.**
- Component amounts sum to the transaction `Amount` on **1,585 of 1,586 rows**,
  with zero mismatches; the remaining row has an empty `Details`. So `Details`
  really is the line breakdown of the transaction.
- Component codes are of exactly two kinds: **134 distinct four-character
  codes**, all length 4, and **one single constant 16-character alphabetic
  label** appearing on 1,069 rows. The constant label is a fee or surcharge
  line, not a vended item, and must never be mapped as one.

## What remains unverified

The four-character codes are established as **line item codes**, because the
components carrying them reconcile financially to the transaction amount. That
they are Seed Live "Coil Name" values, selection identifiers, or planogram
positions is **NOT VERIFIED** — see `CANTALOUPE_SEEDLIVE_INTEGRATION.md` §1C.
They are therefore treated as opaque provider line item identifiers and resolved
through the crosswalk, never guessed.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation

from integrations.cantaloupe.schemas import (
    SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1,
    TRANSACTIONS_IN_PAYMENT_HEADER,
    identify_schema,
)

#: Observed timestamp layout. No timezone component exists in any row.
DATE_FORMAT = "%m/%d/%Y %I:%M:%S %p"

#: `CODE($1.50)` or `CODE(2 * $1.50)`.
_COMPONENT = re.compile(
    r"^\s*(?P<code>[^(]+?)\s*\(\s*(?:(?P<qty>\d+)\s*\*\s*)?"
    r"(?P<amount>-?\$?-?[\d,]+\.?\d*)\s*\)\s*$"
)

#: A component whose code contains a run of letters is the constant fee label,
#: not a vended line item. Every observed line item code is exactly four
#: characters and never contains a three-letter run.
_LOOKS_LIKE_LABEL = re.compile(r"[A-Za-z]{3,}")


class TransactionParseError(ValueError):
    """A row could not be parsed. Never resolved by substituting a default."""

    def __init__(self, row_number: int, field_name: str, reason: str) -> None:
        super().__init__(f"row {row_number}: {field_name}: {reason}")
        self.row_number = row_number
        self.field_name = field_name
        self.reason = reason


class UnsupportedSchema(ValueError):
    """The payload is not the schema this parser is written against."""

    def __init__(self, schema_id: str) -> None:
        super().__init__(
            f"parser handles {SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1!r}, "
            f"not {schema_id!r}"
        )
        self.schema_id = schema_id


def parse_money(raw: str, *, row_number: int = 0, field_name: str = "Amount") -> Decimal:
    """Parse `$1.50`, `-$1.50` or `1.50` into a Decimal, sign preserved.

    Raises rather than defaulting. A silently zeroed amount is a wrong financial
    record that looks like a real one.
    """
    if raw is None:
        raise TransactionParseError(row_number, field_name, "missing")
    text = raw.strip().replace("$", "").replace(",", "").replace(" ", "")
    if not text:
        raise TransactionParseError(row_number, field_name, "empty")
    negative = text.startswith("-")
    text = text.lstrip("-")
    try:
        value = Decimal(text)
    except InvalidOperation as exc:
        raise TransactionParseError(
            row_number, field_name, f"not a monetary value: {raw!r}"
        ) from exc
    return -value if negative else value


def parse_observed_datetime(raw: str, *, row_number: int = 0) -> datetime:
    """Parse the observed timestamp. **Naive on purpose.**

    No row carries a timezone, so attaching one would be invention. The caller
    keeps the raw string alongside this value.
    """
    text = (raw or "").strip()
    if not text:
        raise TransactionParseError(row_number, "Date", "empty")
    try:
        return datetime.strptime(text, DATE_FORMAT)
    except ValueError as exc:
        raise TransactionParseError(
            row_number, "Date", f"does not match {DATE_FORMAT!r}: {text!r}"
        ) from exc


@dataclass(frozen=True)
class SeedLiveDetailComponent:
    """One component of the `Details` breakdown.

    `is_line_item` is False for the constant fee label. A fee is not a vend and
    must never become a line item mapping.
    """

    code: str
    quantity: int
    unit_amount: Decimal
    is_line_item: bool

    @property
    def extended_amount(self) -> Decimal:
        return self.unit_amount * self.quantity


@dataclass(frozen=True)
class SeedLiveTransactionRecord:
    """One provider row, in Seed Live's own terms.

    Provider evidence, not canonical data. The sign of `amount` is preserved as
    supplied, and `date_raw` is retained because the timezone is unknown.
    """

    row_number: int
    reference: str
    reconcile_group: str
    trans_type: str
    settle_state: str
    tran_number: str
    device: str
    terminal: str
    location: str
    asset_number: str
    client: str
    date_raw: str
    occurred_at_naive: datetime
    card_type: str
    amount: Decimal
    ap_code: str
    details_raw: str
    batch_number: str
    components: tuple[SeedLiveDetailComponent, ...] = ()

    #: Always False for this export: no row carries timezone information.
    timezone_known: bool = field(default=False)

    @property
    def line_item_components(self) -> tuple[SeedLiveDetailComponent, ...]:
        return tuple(c for c in self.components if c.is_line_item)

    @property
    def components_total(self) -> Decimal:
        return sum((c.extended_amount for c in self.components), Decimal("0"))

    @property
    def components_reconcile(self) -> bool:
        """Whether the line breakdown sums to the transaction amount.

        A control check, never an authority: a mismatch is reported, not
        corrected, per ADR-0003.
        """
        if not self.components:
            return False
        return self.components_total == abs(self.amount)


def parse_details(raw: str, *, row_number: int = 0) -> tuple[SeedLiveDetailComponent, ...]:
    """Decompose `Details` into components.

    Returns empty for a blank field. Raises if a component is present but does
    not parse, rather than silently dropping part of a transaction.
    """
    text = (raw or "").strip()
    if not text:
        return ()

    components: list[SeedLiveDetailComponent] = []
    for part in text.split(","):
        if not part.strip():
            continue
        match = _COMPONENT.match(part)
        if not match:
            raise TransactionParseError(
                row_number, "Details", f"unrecognised component: {part.strip()!r}"
            )
        code = match.group("code").strip()
        quantity = int(match.group("qty") or 1)
        if quantity <= 0:
            raise TransactionParseError(row_number, "Details", "quantity must be positive")
        components.append(
            SeedLiveDetailComponent(
                code=code,
                quantity=quantity,
                unit_amount=parse_money(
                    match.group("amount"), row_number=row_number, field_name="Details"
                ),
                is_line_item=not _LOOKS_LIKE_LABEL.search(code),
            )
        )
    return tuple(components)


def parse_transactions_csv(
    payload: bytes, *, schema_id: str | None = None
) -> tuple[SeedLiveTransactionRecord, ...]:
    """Parse a recognised Transactions in Payment CSV into provider records.

    `schema_id` may be supplied by a caller that already identified the payload;
    otherwise it is determined here. Either way an unrecognised schema raises
    `UnsupportedSchema` rather than being parsed on a guess.
    """
    resolved = schema_id or identify_schema(payload)
    if resolved != SEEDLIVE_TRANSACTIONS_IN_PAYMENT_CSV_V1:
        raise UnsupportedSchema(resolved)

    text = payload.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    records: list[SeedLiveTransactionRecord] = []
    for index, row in enumerate(reader, start=1):
        missing = [c for c in TRANSACTIONS_IN_PAYMENT_HEADER if c not in row]
        if missing:
            raise TransactionParseError(index, ",".join(missing), "column missing")

        records.append(
            SeedLiveTransactionRecord(
                row_number=index,
                reference=(row["Reference #"] or "").strip(),
                reconcile_group=(row["Reconcile Group"] or "").strip(),
                trans_type=(row["Trans Type"] or "").strip(),
                settle_state=(row["Settle State"] or "").strip(),
                tran_number=(row["Tran #"] or "").strip(),
                device=(row["Device"] or "").strip(),
                terminal=(row["Terminal"] or "").strip(),
                location=(row["Location"] or "").strip(),
                asset_number=(row["Asset #"] or "").strip(),
                client=(row["Client"] or "").strip(),
                date_raw=(row["Date"] or "").strip(),
                occurred_at_naive=parse_observed_datetime(row["Date"], row_number=index),
                card_type=(row["Card Type"] or "").strip(),
                amount=parse_money(row["Amount"], row_number=index),
                ap_code=(row["AP Code"] or "").strip(),
                details_raw=(row["Details"] or "").strip(),
                batch_number=(row["Batch #"] or "").strip(),
                components=parse_details(row["Details"], row_number=index),
            )
        )
    return tuple(records)
