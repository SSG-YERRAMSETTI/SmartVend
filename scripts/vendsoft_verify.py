"""Independent completeness verification for one machine.

Re-extracts a single machine's sales in monthly windows and compares the
deduplicated union against the count returned by one wide-window request.
If the two agree, the wide request was not truncated.

Also characterises the unbounded (no fromDate/toDate) request, which the probe
ladder showed returning fewer rows than a 30-day window.

Usage:  python scripts/vendsoft_verify.py --machine 1
Read-only: GET requests only.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from vendsoft.client import VendSoftReadClient  # noqa: E402
from vendsoft.config import load_config  # noqa: E402
from vendsoft.schemas import parse_transaction_time  # noqa: E402


def month_edges(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    edges = []
    cur = datetime(start.year, start.month, 1)
    while cur < end:
        nxt = datetime(cur.year + (cur.month == 12), (cur.month % 12) + 1, 1)
        edges.append((cur, min(nxt, end)))
        cur = nxt
    return edges


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--machine", required=True)
    ap.add_argument("--interval", type=float, default=1.0)
    ap.add_argument("--start", default="2024-01-01")
    args = ap.parse_args()

    cfg = load_config()
    cfg.min_interval_s = args.interval
    client = VendSoftReadClient(cfg)

    now = datetime.now().replace(microsecond=0)
    start = datetime.fromisoformat(args.start)
    code = args.machine

    out: dict = {"machine": code, "generated": now.isoformat()}

    try:
        # 1) Characterise the unbounded request.
        print("[1/3] unbounded request (no fromDate/toDate) ...", flush=True)
        unb = client.get_sales(code)
        ts = [parse_transaction_time(r.get("transactionTime")) for r in unb]
        ts = [t for t in ts if t]
        out["unbounded"] = {
            "count": len(unb),
            "earliest": min(ts).isoformat() if ts else None,
            "latest": max(ts).isoformat() if ts else None,
            "span_days": (max(ts) - min(ts)).days if ts else None,
        }
        print(f"      {len(unb)} records, "
              f"{out['unbounded']['earliest']} -> {out['unbounded']['latest']} "
              f"({out['unbounded']['span_days']}d span)", flush=True)

        # 2) One wide window.
        print("[2/3] single wide window ...", flush=True)
        wide = client.get_sales(code, start, now)
        wide_ids = {r.get("transactionId") for r in wide}
        out["wide_window"] = {
            "from": start.isoformat(),
            "to": now.isoformat(),
            "count": len(wide),
            "unique_ids": len(wide_ids),
        }
        print(f"      {len(wide)} records, {len(wide_ids)} unique", flush=True)

        # 3) Monthly chunks over the same span.
        edges = month_edges(start, now)
        print(f"[3/3] {len(edges)} monthly windows ...", flush=True)
        monthly_ids: set = set()
        monthly_total = 0
        per_month = {}
        for i, (a, b) in enumerate(edges, 1):
            rows = client.get_sales(code, a, b)
            monthly_total += len(rows)
            monthly_ids |= {r.get("transactionId") for r in rows}
            per_month[f"{a:%Y-%m}"] = len(rows)
            print(f"      {a:%Y-%m}: {len(rows):>6}   "
                  f"(running unique {len(monthly_ids)})", flush=True)

        out["monthly"] = {
            "windows": len(edges),
            "rows_returned": monthly_total,
            "unique_ids": len(monthly_ids),
            "per_month": per_month,
        }

        only_wide = wide_ids - monthly_ids
        only_monthly = monthly_ids - wide_ids
        out["comparison"] = {
            "wide_unique": len(wide_ids),
            "monthly_unique": len(monthly_ids),
            "ids_only_in_wide": len(only_wide),
            "ids_only_in_monthly": len(only_monthly),
            "identical": wide_ids == monthly_ids,
        }

        print("\n--- verification ---")
        print(f"wide window unique ids : {len(wide_ids)}")
        print(f"monthly union unique   : {len(monthly_ids)}")
        print(f"only in wide           : {len(only_wide)}")
        print(f"only in monthly        : {len(only_monthly)}")
        print(f"IDENTICAL              : {wide_ids == monthly_ids}")
        if wide_ids == monthly_ids:
            print("\nVERDICT: the wide-window response was NOT truncated.")
        else:
            print("\nVERDICT: MISMATCH — the wide-window response is incomplete.")

    finally:
        out["requests_made"] = len(client.requests_made)
        client.close()

    dest = REPO_ROOT / "data" / "vendsoft" / "reports"
    dest.mkdir(parents=True, exist_ok=True)
    p = dest / f"verification_machine_{code}.json"
    p.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"\nwrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
