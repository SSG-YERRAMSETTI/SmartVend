"""Pydantic models mirroring docs/vendsoft/openapi.json (VendSoft API v2.0.0).

Every model uses extra="allow" so that undocumented fields returned by the live
API are preserved rather than dropped. `extra_fields()` surfaces them, which is
how the coverage analysis detects spec drift.

Only the five documented GET response schemas are modelled here. Request bodies
for POST/PUT operations are deliberately absent — this package cannot write.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from pydantic import BaseModel, ConfigDict


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    def extra_fields(self) -> set[str]:
        """Field names present in the payload but absent from the spec."""
        return set(self.model_dump().keys()) - set(type(self).model_fields.keys())


class Product(_Base):
    productCode: str | None = None
    productName: str | None = None
    productType: str | None = None
    barcode: str | None = None
    unitsPerCase: int | None = None
    lastCost: float | None = None
    averageCost: float | None = None


class Machine(_Base):
    machineCode: str | None = None
    machineName: str | None = None
    machineType: str | None = None  # Soda|Snack|Coffee|Soda/Snack|Snack/Coffee
    machineModel: str | None = None
    locationName: str | None = None


class Location(_Base):
    locationCode: str | None = None
    locationName: str | None = None
    addressLine1: str | None = None
    addressLine2: str | None = None
    city: str | None = None
    region: str | None = None
    zipCode: str | None = None


class Column(_Base):
    """A planogram slot. Identity is machineCode + column."""

    column: str | None = None
    columnType: str | None = None  # soda|drink|ingredient
    productCode: str | None = None
    productName: str | None = None
    productType: str | None = None
    vendPrice: float | None = None
    maxCapacity: int | None = None
    lastCount: int | None = None


class TelemetrySale(_Base):
    # Spec marks these required: telemetryId, transactionId, transactionTime,
    # machineCode, quantity, price. They are Optional here so that a
    # non-conforming live response is captured and reported rather than
    # raising and aborting the extraction.
    telemetryId: str | None = None
    transactionId: int | None = None
    transactionTime: str | None = None
    productName: str | None = None
    machineCode: str | None = None
    productCode: str | None = None
    creditCard: str | None = None
    quantity: int | None = None
    selection: str | None = None
    price: float | None = None
    machineName: str | None = None


REQUIRED_SALE_FIELDS = (
    "telemetryId",
    "transactionId",
    "transactionTime",
    "machineCode",
    "quantity",
    "price",
)

# VendSoft's documented date-parameter format for fromDate / toDate.
VENDSOFT_DT_FORMAT = "%Y%m%d%H%M%S"


def format_dt(dt: datetime) -> str:
    return dt.strftime(VENDSOFT_DT_FORMAT)


def parse_transaction_time(value: str | None) -> datetime | None:
    """Parse transactionTime leniently.

    The spec types it as a bare string with no format, so the live shape is
    unknown until observed. Several plausible encodings are attempted.
    """
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    candidates = (
        VENDSOFT_DT_FORMAT,
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y",
    )
    for fmt in candidates:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00").replace(" UTC", ""))
    except ValueError:
        return None


def parse_many(model: type[_Base], payload: Any) -> tuple[list[_Base], list[str]]:
    """Parse a JSON array into models, collecting per-row errors instead of raising."""
    rows: list[_Base] = []
    errors: list[str] = []
    if not isinstance(payload, list):
        return rows, [f"expected a JSON array, got {type(payload).__name__}"]
    for i, item in enumerate(payload):
        try:
            rows.append(model.model_validate(item))
        except Exception as exc:  # noqa: BLE001 - collected, not swallowed
            errors.append(f"row {i}: {exc}")
    return rows, errors


def collect_extra_fields(rows: Iterable[_Base]) -> set[str]:
    found: set[str] = set()
    for r in rows:
        found |= r.extra_fields()
    return found
