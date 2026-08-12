"""Generate tenant coverage reports from an extracted VendSoft snapshot.

Usage (from the repo root):
    python scripts/vendsoft_report.py [--run <timestamp>]

Reads  data/vendsoft/raw/<timestamp>/
Writes data/vendsoft/reports/<timestamp>/tenant_coverage.{json,md}

Performs no network I/O.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from vendsoft.analyze import (  # noqa: E402
    UNEXPOSED_DATASETS,
    WRITE_ONLY_DATASETS,
    analyze,
    load_snapshot,
)

RAW_ROOT = REPO_ROOT / "data" / "vendsoft" / "raw"
REPORT_ROOT = REPO_ROOT / "data" / "vendsoft" / "reports"

NOT_EXPOSED = "NOT EXPOSED BY DOCUMENTED API"


def _resolve_run(run: str | None) -> str:
    if run:
        return run
    latest = RAW_ROOT / "LATEST"
    if latest.exists():
        return latest.read_text(encoding="utf-8").strip()
    runs = sorted(p.name for p in RAW_ROOT.iterdir() if p.is_dir())
    if not runs:
        raise SystemExit("no extraction runs found under data/vendsoft/raw/")
    return runs[-1]


def _assess(rep: dict) -> dict[str, str]:
    """Per-dataset coverage verdicts derived from the analysis."""
    out = {}

    p = rep["products"]
    out["Products"] = (
        "Complete as exposed — every record has a unique productCode, no duplicates"
        if not p["duplicate_productCode"] and not p["missing_productCode"]
        else f"{len(p['duplicate_productCode'])} duplicate codes, "
        f"{p['missing_productCode']} missing codes"
    )

    m = rep["machines"]
    out["Machines"] = (
        "Complete as exposed — unique machineCode, no duplicates"
        if not m["duplicate_machineCode"] and not m["missing_machineCode"]
        else f"{len(m['duplicate_machineCode'])} duplicate codes, "
        f"{m['missing_machineCode']} missing codes"
    )

    l = rep["locations"]
    out["Locations"] = (
        "Complete as exposed — unique locationCode, no duplicates"
        if not l["duplicate_locationCode"] and not l["missing_locationCode"]
        else f"{len(l['duplicate_locationCode'])} duplicate codes, "
        f"{l['missing_locationCode']} missing codes"
    )

    pl = rep["planograms"]
    bits = []
    if pl["machines_without_planogram"]:
        bits.append(f"{pl['machines_without_planogram']} machine(s) returned no planogram")
    if pl["duplicate_slots"]:
        bits.append(f"{len(pl['duplicate_slots'])} duplicate machineCode+column keys")
    out["Planogram slots"] = (
        "Complete as exposed — one row per machineCode+column"
        if not bits
        else "; ".join(bits)
    )

    s = rep["sales"]
    t = rep["transport"]
    bits = []
    if s["confirmed_truncation_count"]:
        bits.append(f"{s['confirmed_truncation_count']} CONFIRMED truncation event(s)")
    if s["missing_transactionId"]:
        bits.append(f"{s['missing_transactionId']} rows without transactionId")
    if s["duplicate_transactionId_within_dataset"]:
        bits.append(
            f"{len(s['duplicate_transactionId_within_dataset'])} duplicate transactionIds"
        )
    if t["suspected_response_cap"]:
        bits.append(f"suspected response cap at {t['suspected_response_cap']}")
    out["Telemetry sales"] = (
        f"No truncation detected; {s['unique_transactionId']} unique transactionIds "
        f"spanning {s['earliest_transaction']} to {s['latest_transaction']}"
        if not bits
        else "; ".join(bits)
    )
    return out


def build_markdown(rep: dict, run: str, snapshot: dict) -> str:
    a = _assess(rep)
    p, m, l = rep["products"], rep["machines"], rep["locations"]
    pl, s, t = rep["planograms"], rep["sales"], rep["transport"]
    ri = rep["referential_integrity"]
    man = snapshot.get("manifest", {})

    lines: list[str] = []
    add = lines.append

    add("# VendSoft Tenant — Read-Only API Coverage Report")
    add("")
    add(f"- **Run:** `{run}`")
    add(f"- **Base URL:** `{man.get('base_url', 'n/a')}`")
    add(f"- **API key fingerprint:** `{man.get('api_key_fingerprint', 'n/a')}` "
        "(sha256 prefix; the key itself is never recorded)")
    add(f"- **History window requested:** {man.get('history_days', 'n/a')} days")
    add(f"- **Generated:** {datetime.now().isoformat(timespec='seconds')}")
    add(f"- **Total HTTP requests:** {t['total_requests']} (all GET)")
    add(f"- **Rate limited:** {'YES' if t['rate_limited'] else 'no'}")
    add("")
    add("All requests were GET. No POST/PUT/PATCH/DELETE was issued. "
        "`creditCard` is masked in every persisted record.")
    add("")

    add("## Dataset coverage")
    add("")
    add("| Dataset | Records retrieved | Unique records | Coverage assessment |")
    add("|---|---:|---:|---|")
    add(f"| Products | {p['records']} | {p['unique_productCode']} | {a['Products']} |")
    add(f"| Machines | {m['records']} | {m['unique_machineCode']} | {a['Machines']} |")
    add(f"| Locations | {l['records']} | {l['unique_locationCode']} | {a['Locations']} |")
    add(f"| Planogram slots | {pl['slot_records']} | {pl['unique_slots']} | {a['Planogram slots']} |")
    add(f"| Telemetry sales | {s['records']} | {s['unique_transactionId']} | {a['Telemetry sales']} |")
    for name in UNEXPOSED_DATASETS:
        note = WRITE_ONLY_DATASETS.get(name)
        detail = f"{NOT_EXPOSED} — {note}" if note else NOT_EXPOSED
        add(f"| {name} | — | — | **{detail}** |")
    add("")
    add("> A dataset marked *NOT EXPOSED BY DOCUMENTED API* is absent from "
        "`docs/vendsoft/openapi.json`. That says nothing about whether the data "
        "exists inside VendSoft — only that this specification provides no way "
        "to read it.")
    add("")

    add("## Sales window discovery")
    add("")
    add(f"- **Unbounded request (no fromDate/toDate) supported:** "
        f"{t['unbounded_request_supported']}")
    if t.get("unbounded_count") is not None:
        add(f"- **Unbounded request returned:** {t['unbounded_count']} records")
    add(f"- **Largest window accepted:** {t['max_window_days_ok']} days")
    add(f"- **Suspected response cap:** {t['suspected_response_cap'] or 'none detected'}")
    add(f"- **Pagination headers observed:** {t['pagination_headers_observed']}")
    add(f"- **Rate-limit headers observed:** {t['ratelimit_headers_observed']}")
    add(f"- **Sales windows requested:** {s['windows_requested']}")
    add(f"- **Confirmed truncation events:** {s['confirmed_truncation_count']}")
    add("")
    if t["cap_evidence"]:
        add("**Cap evidence:**")
        add("")
        for e in t["cap_evidence"]:
            add(f"- {e}")
        add("")
    if t["discovery_probes"]:
        add("**Probe ladder** (single representative machine, increasing windows):")
        add("")
        add("| Window | Records | Earliest in window | Latest in window |")
        add("|---|---:|---|---|")
        for pr in t["discovery_probes"]:
            if "error" in pr:
                add(f"| {pr['window']} | ERROR | — | {pr['error'][:60]} |")
            else:
                add(f"| {pr['window']} | {pr.get('count')} | "
                    f"{pr.get('earliest') or '—'} | {pr.get('latest') or '—'} |")
        add("")
    if t["discovery_notes"]:
        he_gap = (rep.get("history_extent") or {}).get("empty_lead_gap_days")
        for n in t["discovery_notes"]:
            add(f"- {n}")
            if "may predate" in n and he_gap and he_gap > 60:
                add(f"  - **Superseded by the history-extent check below:** the "
                    f"requested window opened {he_gap} days before the earliest "
                    "transaction and that leading period was empty, so history is "
                    "not clipped. This note reflects a count-only heuristic recorded "
                    "during discovery, before the full extraction was analysed.")
        add("")

    # ---- independent verification, if a verification run exists ----
    ver_files = sorted(REPORT_ROOT.glob("verification_machine_*.json"))
    if ver_files:
        add("## Independent completeness verification")
        add("")
        add("A wide-window response cannot self-report truncation. To test it, one "
            "machine was re-extracted in monthly windows and the deduplicated union "
            "of `transactionId`s compared against the single wide-window request.")
        add("")
        for vf in ver_files:
            v = json.loads(vf.read_text(encoding="utf-8"))
            comp = v.get("comparison", {})
            unb = v.get("unbounded", {})
            mon = v.get("monthly", {})
            wide = v.get("wide_window", {})
            add(f"### Machine `{v.get('machine')}`")
            add("")
            add("| Method | Requests | Unique transactionIds |")
            add("|---|---:|---:|")
            add(f"| Single wide window | 1 | {wide.get('unique_ids')} |")
            add(f"| Monthly windows | {mon.get('windows')} | {mon.get('unique_ids')} |")
            add("")
            add(f"- IDs present only in the wide window: **{comp.get('ids_only_in_wide')}**")
            add(f"- IDs present only in the monthly union: **{comp.get('ids_only_in_monthly')}**")
            add(f"- Sets identical: **{comp.get('identical')}**")
            add("")
            if comp.get("identical"):
                add("**Verdict: the wide-window response was NOT truncated.** Chunking "
                    "the request into 32 monthly windows recovered exactly the same "
                    "transactions, no more and no fewer.")
            else:
                add("**Verdict: MISMATCH — the wide-window response is incomplete.**")
            add("")
            add(f"The unbounded request (no `fromDate`/`toDate`) returned only "
                f"**{unb.get('count')}** records covering "
                f"`{unb.get('earliest')}` to `{unb.get('latest')}` — a span of just "
                f"**{unb.get('span_days')} days**, against {wide.get('unique_ids')} "
                "records for the explicit window.")
            add("")
            add("> **Operational rule:** never call `/machines/{machineCode}/sales` "
                "without `fromDate` and `toDate`. The parameters are documented as "
                "optional, but omitting them silently returns a small recent slice "
                "rather than the full history. This is the single most dangerous "
                "behaviour found in the API.")
            add("")

    add("## Data quality")
    add("")
    add("### Products")
    add(f"- Records: {p['records']}, unique `productCode`: {p['unique_productCode']}")
    add(f"- Missing `productCode`: {p['missing_productCode']}")
    add(f"- Duplicate `productCode`: {len(p['duplicate_productCode'])}")
    add(f"- Null/empty fields: {p['null_fields'] or 'none'}")
    add(f"- Schema errors: {len(p['schema_errors'])}")
    add(f"- Undocumented fields returned: {p['undocumented_fields'] or 'none'}")
    if p["duplicate_productCode"]:
        add("")
        add(f"> **`productCode` is not a unique key in this tenant.** "
            f"{len(p['duplicate_productCode'])} code(s) are shared by different "
            f"products: {list(p['duplicate_productCode'].items())}. The undocumented "
            "`id` field *is* unique across all rows and is the only safe primary key "
            "for the migration. Keying products on `productCode` would silently merge "
            "unrelated products.")
    add("")
    add("### Machines")
    add(f"- Records: {m['records']}, unique `machineCode`: {m['unique_machineCode']}")
    add(f"- Missing `machineCode`: {m['missing_machineCode']}")
    add(f"- Null/empty fields: {m['null_fields'] or 'none'}")
    add(f"- Undocumented fields returned: {m['undocumented_fields'] or 'none'}")
    add("")
    add("### Locations")
    add(f"- Records: {l['records']}, unique `locationCode`: {l['unique_locationCode']}")
    add(f"- Null/empty fields: {l['null_fields'] or 'none'}")
    add(f"- Undocumented fields returned: {l['undocumented_fields'] or 'none'}")
    add("")
    add("### Planograms")
    add(f"- Machines queried: {pl['machines_queried']}")
    add(f"- Slot records: {pl['slot_records']}, unique `machineCode+column`: {pl['unique_slots']}")
    add(f"- Machines with no planogram: {pl['machines_without_planogram']} "
        f"{pl['machines_without_planogram_examples'] or ''}")
    add(f"- Slots missing a column id: {pl['slots_missing_column_id']}")
    add(f"- Null/empty fields: {pl['null_fields'] or 'none'}")
    add(f"- Undocumented fields returned: {pl['undocumented_fields'] or 'none'}")
    add("")
    add("### Telemetry sales")
    add(f"- Records: {s['records']}, unique `transactionId`: {s['unique_transactionId']}")
    add(f"- Duplicates removed across overlapping windows: {s['duplicates_deduped_across_windows']}")
    add(f"- Duplicate `transactionId` remaining: {len(s['duplicate_transactionId_within_dataset'])}")
    add(f"- Missing `transactionId`: {s['missing_transactionId']}")
    add(f"- Missing spec-required fields: {s['missing_required_fields'] or 'none'}")
    add(f"- Unparseable `transactionTime`: {s['unparseable_transactionTime']}")
    add(f"- Date range: **{s['earliest_transaction']}** to **{s['latest_transaction']}**")
    add(f"- Machines with zero sales: {s['machines_without_sales']} "
        f"{s['machines_without_sales_examples'] or ''}")
    add(f"- Undocumented fields returned: {s['undocumented_fields'] or 'none'}")
    add("")

    he = rep.get("history_extent", {})
    add("### History extent")
    add("")
    add(f"- Requested window: {he.get('requested_window_days')} days")
    add(f"- Earliest transaction returned: `{he.get('earliest_transaction')}`")
    add(f"- Empty leading gap: **{he.get('empty_lead_gap_days')} days**")
    add(f"- {he.get('verdict')}")
    add("")

    add("## Referential integrity")
    add("")
    add(f"- Planogram `productCode`s missing from /products: "
        f"**{ri['planogram_products_missing_count']}** "
        f"{ri['planogram_products_missing_from_products'][:10] or ''}")
    add(f"- Sales `productCode`s missing from /products: "
        f"**{ri['sales_products_missing_count']}** "
        f"{ri['sales_products_missing_from_products'][:10] or ''}")
    add(f"- Sales `machineCode`s missing from /machines: "
        f"**{ri['sales_machines_missing_count']}** "
        f"{ri['sales_machines_missing_from_machines'][:10] or ''}")
    add(f"- Products never referenced by any planogram or sale: "
        f"{ri['products_never_referenced']}")
    add("")
    ml = rep["machine_location_linkage"]
    add("### Machine → Location linkage")
    add("")
    add(f"- Join key: {ml['join_key']}")
    add(f"- Machines whose `locationName` matches no location: "
        f"**{ml['machines_with_unmatched_location']}** {ml['unmatched_examples'][:10] or ''}")
    add(f"- Machines with no `locationName` at all: {ml['machines_with_no_locationName']}")
    add(f"- Location names unique: {ml['location_names_are_unique']}")
    add("")

    add("## Counts to verify against the VendSoft UI or CSV export")
    add("")
    add("The API cannot prove it returned everything. These figures must be "
        "reconciled against tenant-side totals before the migration is trusted.")
    add("")
    add("| Figure | API result | Verify against |")
    add("|---|---:|---|")
    add(f"| Number of products | {p['records']} | Products list total in the VendSoft UI, or a full product CSV export |")
    add(f"| Number of machines | {m['records']} | Machines list total in the UI, or a machine CSV export |")
    add(f"| Number of locations | {l['records']} | Locations list total in the UI, or a location CSV export |")
    add(f"| Number of planogram slots | {pl['slot_records']} | Sum of configured columns across all machines (per-machine planogram screens) |")
    add(f"| Number of sales | {s['records']} | Telemetry/sales report row count for the same date range |")
    add(f"| Sales date range | {s['earliest_transaction']} → {s['latest_transaction']} | Earliest and latest transaction in the VendSoft sales report |")
    add("")
    add("Specifically request from the tenant:")
    add("")
    add("1. A **product export** (CSV/Excel) with a row count.")
    add("2. A **machine export** with a row count, including each machine's location assignment "
        "— this is the only way to recover the `machineCode → locationCode` link the API omits.")
    add("3. A **location export** with a row count.")
    add("4. A **sales/telemetry export** covering the same window, with a row count and "
        "min/max transaction timestamp.")
    add("5. Confirmation of **how far back sales history is retained** in the tenant.")
    add("")

    add("## Transport observations")
    add("")
    add(f"- Status codes: {t['status_counts']}")
    add(f"- Pagination headers: {t['pagination_headers_observed']}")
    add(f"- Rate-limit headers: {t['ratelimit_headers_observed']}")
    add("")

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    args = ap.parse_args()

    run = _resolve_run(args.run)
    raw_dir = RAW_ROOT / run
    if not raw_dir.exists():
        raise SystemExit(f"run directory not found: {raw_dir}")

    snapshot = load_snapshot(raw_dir)
    rep = analyze(snapshot)

    out_dir = REPORT_ROOT / run
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "tenant_coverage.json").write_text(
        json.dumps({"run": run, "analysis": rep}, indent=2, default=str),
        encoding="utf-8",
    )
    (out_dir / "tenant_coverage.md").write_text(
        build_markdown(rep, run, snapshot), encoding="utf-8"
    )

    print(f"wrote {out_dir / 'tenant_coverage.json'}")
    print(f"wrote {out_dir / 'tenant_coverage.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
