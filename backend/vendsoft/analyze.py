"""Completeness analysis over an extracted VendSoft tenant snapshot.

Consumes the raw directory written by extract.py and produces the coverage
report structure. Performs no network I/O.

Identifiers:
    Product        productCode
    Machine        machineCode
    Location       locationCode
    Planogram slot machineCode + column
    Sale           transactionId
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from .schemas import (
    REQUIRED_SALE_FIELDS,
    Column,
    Location,
    Machine,
    Product,
    TelemetrySale,
    collect_extra_fields,
    parse_many,
    parse_transaction_time,
)

# Datasets a vending operator typically needs to migrate. Anything the OpenAPI
# spec does not expose via GET is reported as NOT EXPOSED rather than assumed
# absent from VendSoft.
UNEXPOSED_DATASETS = (
    "Purchases",
    "Cash collections",
    "Trips",
    "Routes",
    "Expenses",
    "Suppliers",
    "Users",
    "Commissions",
    "Tickets",
)

# Datasets with a write endpoint but no read endpoint — data can be pushed into
# VendSoft but not pulled out. Worth calling out separately.
WRITE_ONLY_DATASETS = {
    "Trips": "POST /trips exists; no GET",
    "Purchases": "POST /purchases exists; no GET",
    "Tickets": "POST /tickets exists; no GET",
}


def _dup_counts(values: list[Any]) -> dict[str, int]:
    c = Counter(v for v in values if v is not None)
    return {str(k): n for k, n in c.items() if n > 1}


def _null_field_counts(rows: list[dict[str, Any]], fields: tuple[str, ...]) -> dict[str, int]:
    out: dict[str, int] = {}
    for f in fields:
        n = sum(1 for r in rows if r.get(f) in (None, ""))
        if n:
            out[f] = n
    return out


def load_snapshot(raw_dir: Path) -> dict[str, Any]:
    def _read(name: str, default: Any) -> Any:
        p = raw_dir / name
        if not p.exists():
            return default
        return json.loads(p.read_text(encoding="utf-8"))

    products = _read("products.json", [])
    locations = _read("locations.json", [])
    machines = _read("machines.json", [])
    discovery = _read("_discovery.json", {})
    manifest = _read("_manifest.json", {})
    requests_log = _read("_requests.json", [])

    planograms: dict[str, list[dict[str, Any]]] = {}
    pdir = raw_dir / "planograms"
    if pdir.exists():
        for f in sorted(pdir.glob("*.json")):
            planograms[f.stem] = json.loads(f.read_text(encoding="utf-8"))

    sales: dict[str, dict[str, Any]] = {}
    sdir = raw_dir / "sales"
    if sdir.exists():
        for f in sorted(sdir.glob("*.json")):
            sales[f.stem] = json.loads(f.read_text(encoding="utf-8"))

    return {
        "products": products,
        "locations": locations,
        "machines": machines,
        "planograms": planograms,
        "sales": sales,
        "discovery": discovery,
        "manifest": manifest,
        "requests": requests_log,
    }


def analyze(snapshot: dict[str, Any]) -> dict[str, Any]:
    products: list[dict] = snapshot["products"]
    locations: list[dict] = snapshot["locations"]
    machines: list[dict] = snapshot["machines"]
    planograms: dict[str, list[dict]] = snapshot["planograms"]
    sales_files: dict[str, dict] = snapshot["sales"]
    discovery: dict = snapshot["discovery"]

    report: dict[str, Any] = {}

    # ---- schema conformance ----
    prod_rows, prod_errs = parse_many(Product, products)
    loc_rows, loc_errs = parse_many(Location, locations)
    mach_rows, mach_errs = parse_many(Machine, machines)

    # ---- products ----
    p_codes = [p.get("productCode") for p in products]
    report["products"] = {
        "records": len(products),
        "unique_productCode": len({c for c in p_codes if c is not None}),
        "duplicate_productCode": _dup_counts(p_codes),
        "missing_productCode": sum(1 for c in p_codes if c in (None, "")),
        "null_fields": _null_field_counts(
            products, ("productName", "productType", "barcode", "unitsPerCase",
                       "lastCost", "averageCost")
        ),
        "schema_errors": prod_errs,
        "undocumented_fields": sorted(collect_extra_fields(prod_rows)),
        # `id` is undocumented but appears in live responses; check whether it is
        # a viable primary key given productCode collisions.
        "unique_undocumented_id": len({p.get("id") for p in products if p.get("id")}),
        "duplicate_undocumented_id": _dup_counts([p.get("id") for p in products]),
    }

    # ---- locations ----
    l_codes = [l.get("locationCode") for l in locations]
    report["locations"] = {
        "records": len(locations),
        "unique_locationCode": len({c for c in l_codes if c is not None}),
        "duplicate_locationCode": _dup_counts(l_codes),
        "missing_locationCode": sum(1 for c in l_codes if c in (None, "")),
        "null_fields": _null_field_counts(
            locations, ("locationName", "addressLine1", "city", "region", "zipCode")
        ),
        "schema_errors": loc_errs,
        "undocumented_fields": sorted(collect_extra_fields(loc_rows)),
    }

    # ---- machines ----
    m_codes = [m.get("machineCode") for m in machines]
    report["machines"] = {
        "records": len(machines),
        "unique_machineCode": len({c for c in m_codes if c is not None}),
        "duplicate_machineCode": _dup_counts(m_codes),
        "missing_machineCode": sum(1 for c in m_codes if c in (None, "")),
        "null_fields": _null_field_counts(
            machines, ("machineName", "machineType", "machineModel", "locationName")
        ),
        "schema_errors": mach_errs,
        "undocumented_fields": sorted(collect_extra_fields(mach_rows)),
    }

    # ---- machine -> location linkage ----
    # The spec gives Machine only `locationName`, a display string, not
    # locationCode. Joining is therefore by name and is inherently lossy.
    loc_names = {
        (l.get("locationName") or "").strip().casefold()
        for l in locations
        if l.get("locationName")
    }
    unmatched = [
        m.get("machineCode")
        for m in machines
        if (m.get("locationName") or "").strip().casefold() not in loc_names
    ]
    machines_no_locname = [
        m.get("machineCode") for m in machines if not m.get("locationName")
    ]
    report["machine_location_linkage"] = {
        "join_key": "locationName (display string) — machineCode->locationCode is NOT exposed",
        "machines_with_unmatched_location": len(unmatched),
        "unmatched_examples": unmatched[:25],
        "machines_with_no_locationName": len(machines_no_locname),
        "location_names_are_unique": len(loc_names)
        == len([l for l in locations if l.get("locationName")]),
    }

    # ---- planograms ----
    all_slots: list[tuple[str, str]] = []
    slot_rows_all: list[dict] = []
    plan_errs: list[str] = []
    machines_without_planogram: list[str] = []
    for code, rows in planograms.items():
        if not rows:
            machines_without_planogram.append(code)
        parsed, errs = parse_many(Column, rows)
        plan_errs.extend(f"{code}: {e}" for e in errs)
        for r in rows:
            if isinstance(r, dict):
                slot_rows_all.append(r)
                all_slots.append((code, r.get("column")))

    slot_keys = [f"{m}|{c}" for m, c in all_slots]
    col_parsed, _ = parse_many(Column, slot_rows_all)
    report["planograms"] = {
        "machines_queried": len(planograms),
        "slot_records": len(all_slots),
        "unique_slots": len(set(slot_keys)),
        "duplicate_slots": _dup_counts(slot_keys),
        "slots_missing_column_id": sum(1 for _, c in all_slots if c in (None, "")),
        "machines_without_planogram": len(machines_without_planogram),
        "machines_without_planogram_examples": machines_without_planogram[:25],
        "null_fields": _null_field_counts(
            slot_rows_all,
            ("columnType", "productCode", "productName", "vendPrice",
             "maxCapacity", "lastCount"),
        ),
        "schema_errors": plan_errs[:50],
        "undocumented_fields": sorted(collect_extra_fields(col_parsed)),
    }

    # ---- sales ----
    all_sales: list[dict] = []
    truncation_events: list[dict] = []
    dup_across_windows = 0
    machines_without_sales: list[str] = []
    windows_total = 0
    for code, payload in sales_files.items():
        rows = payload.get("sales", [])
        if not rows:
            machines_without_sales.append(payload.get("machineCode") or code)
        all_sales.extend(rows)
        dup_across_windows += payload.get("duplicates_across_windows", 0)
        windows_total += len(payload.get("windows_used", []))
        for ev in payload.get("truncation_events", []):
            truncation_events.append({"machineCode": code, **ev})

    tids = [s.get("transactionId") for s in all_sales]
    sale_rows, sale_errs = parse_many(TelemetrySale, all_sales)
    stamps = [parse_transaction_time(s.get("transactionTime")) for s in all_sales]
    stamps = [s for s in stamps if s]

    missing_required = {
        f: sum(1 for s in all_sales if s.get(f) in (None, ""))
        for f in REQUIRED_SALE_FIELDS
    }
    missing_required = {k: v for k, v in missing_required.items() if v}

    confirmed_trunc = [
        t for t in truncation_events if "CONFIRMED truncation" in str(t.get("verdict"))
    ]

    report["sales"] = {
        "records": len(all_sales),
        "unique_transactionId": len({t for t in tids if t is not None}),
        "duplicate_transactionId_within_dataset": _dup_counts(tids),
        "duplicates_deduped_across_windows": dup_across_windows,
        "missing_transactionId": sum(1 for t in tids if t is None),
        "missing_required_fields": missing_required,
        "unparseable_transactionTime": sum(
            1 for s in all_sales if s.get("transactionTime") and
            parse_transaction_time(s.get("transactionTime")) is None
        ),
        "earliest_transaction": min(stamps).isoformat() if stamps else None,
        "latest_transaction": max(stamps).isoformat() if stamps else None,
        "machines_without_sales": len(machines_without_sales),
        "machines_without_sales_examples": machines_without_sales[:25],
        "windows_requested": windows_total,
        "truncation_events": truncation_events[:50],
        "confirmed_truncation_count": len(confirmed_trunc),
        "schema_errors": sale_errs[:50],
        "undocumented_fields": sorted(collect_extra_fields(sale_rows)),
    }

    # ---- cross-dataset referential integrity ----
    product_codes = {p.get("productCode") for p in products if p.get("productCode")}
    plan_refs = {
        r.get("productCode") for r in slot_rows_all if r.get("productCode")
    }
    sale_refs = {s.get("productCode") for s in all_sales if s.get("productCode")}
    machine_codes = {m.get("machineCode") for m in machines if m.get("machineCode")}
    sale_machine_refs = {
        s.get("machineCode") for s in all_sales if s.get("machineCode")
    }

    report["referential_integrity"] = {
        "planogram_products_missing_from_products": sorted(plan_refs - product_codes)[:50],
        "planogram_products_missing_count": len(plan_refs - product_codes),
        "sales_products_missing_from_products": sorted(sale_refs - product_codes)[:50],
        "sales_products_missing_count": len(sale_refs - product_codes),
        "sales_machines_missing_from_machines": sorted(sale_machine_refs - machine_codes)[:50],
        "sales_machines_missing_count": len(sale_machine_refs - machine_codes),
        "products_never_referenced": len(product_codes - plan_refs - sale_refs),
    }

    # ---- pagination / truncation evidence ----
    reqs = snapshot.get("requests", [])
    pagination_headers = sorted(
        {
            h
            for r in reqs
            for h in (r.get("headers") or {})
            if h.lower()
            in (
                "link", "x-total-count", "x-total-pages", "x-page",
                "x-per-page", "x-next-page", "content-range",
            )
        }
    )
    ratelimit_headers = sorted(
        {
            h
            for r in reqs
            for h in (r.get("headers") or {})
            if "ratelimit" in h.lower() or h.lower() == "retry-after"
        }
    )
    statuses = Counter(r.get("status") for r in reqs)

    report["transport"] = {
        "total_requests": len(reqs),
        "status_counts": {str(k): v for k, v in statuses.items()},
        "pagination_headers_observed": pagination_headers or "NONE",
        "ratelimit_headers_observed": ratelimit_headers or "NONE",
        "rate_limited": statuses.get(429, 0) > 0,
        "suspected_response_cap": discovery.get("suspected_cap"),
        "cap_evidence": discovery.get("cap_evidence", []),
        "max_window_days_ok": discovery.get("max_window_days_ok"),
        "unbounded_request_supported": discovery.get("unbounded_request_supported"),
        "unbounded_count": discovery.get("unbounded_count"),
        "discovery_probes": discovery.get("probes", []),
        "discovery_notes": discovery.get("notes", []),
    }

    # ---- history extent ----
    # If the requested window opens well before the earliest record returned, and
    # the API still returned nothing in that leading gap, history genuinely starts
    # at the earliest record rather than being clipped by the window.
    history_days = snapshot.get("manifest", {}).get("history_days")
    earliest = report["sales"]["earliest_transaction"]
    lead_gap_days = None
    if history_days and earliest:
        from datetime import datetime as _dt, timedelta as _td

        started = snapshot["manifest"].get("started_at")
        if started:
            window_start = _dt.fromisoformat(started) - _td(days=history_days)
            lead_gap_days = (_dt.fromisoformat(earliest) - window_start).days

    report["history_extent"] = {
        "earliest_transaction": earliest,
        "latest_transaction": report["sales"]["latest_transaction"],
        "requested_window_days": history_days,
        "empty_lead_gap_days": lead_gap_days,
        "verdict": (
            f"The requested window opened {lead_gap_days} days before the earliest "
            "transaction returned and that leading period came back empty, so sales "
            "history begins at the earliest transaction rather than being clipped "
            "by the window."
            if lead_gap_days and lead_gap_days > 60
            else "Insufficient leading gap to conclude that history was not clipped; "
            "widen the window and re-probe."
        ),
    }

    return report
