"""Read-only full-tenant VendSoft extraction.

Usage (from the repo root):
    python scripts/vendsoft_extract.py [--history-days N] [--interval SECONDS]

Writes to data/vendsoft/raw/<timestamp>/ (gitignored). Makes GET requests only.
Aborts on authentication failure or HTTP 429.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from vendsoft.client import VendSoftReadClient  # noqa: E402
from vendsoft.config import load_config  # noqa: E402
from vendsoft.extract import ExtractionAborted, TenantExtractor  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--history-days", type=int, default=1825)
    ap.add_argument("--interval", type=float, default=1.0)
    ap.add_argument("--max-requests", type=int, default=2000)
    args = ap.parse_args()

    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    out_dir = REPO_ROOT / "data" / "vendsoft" / "raw" / stamp
    out_dir.mkdir(parents=True, exist_ok=True)

    cfg = load_config()
    cfg.min_interval_s = args.interval

    print(f"output    : {out_dir}")
    print(f"base_url  : {cfg.base_url}")
    print(f"key       : loaded ({len(cfg.api_key)} chars, fp={cfg.key_fingerprint})")
    print(f"history   : {args.history_days} days")
    print(f"pacing    : {args.interval}s between requests\n", flush=True)

    started = time.monotonic()
    client = VendSoftReadClient(cfg)

    def progress(msg: str) -> None:
        n = len(client.requests_made)
        print(f"[{n:>4}] [{time.monotonic() - started:7.1f}s] {msg}", flush=True)

    extractor = TenantExtractor(
        client,
        out_dir,
        history_days=args.history_days,
        max_requests=args.max_requests,
        progress=progress,
    )

    try:
        result = extractor.run()
    except ExtractionAborted as exc:
        print(f"\nABORTED: {exc}", flush=True)
        print(f"partial output retained in {out_dir}")
        return 2
    finally:
        client.close()

    sales_total = sum(len(r.sales) for r in result["sales"].values())
    print("\n--- extraction complete ---")
    print(f"requests   : {len(client.requests_made)}")
    print(f"elapsed    : {time.monotonic() - started:.1f}s")
    print(f"products   : {len(result['products'])}")
    print(f"locations  : {len(result['locations'])}")
    print(f"machines   : {len(result['machines'])}")
    print(f"planograms : {len(result['planograms'])}")
    print(f"sales      : {sales_total}")
    print(f"output     : {out_dir}")

    # Marker file so the analysis step can find the newest run.
    (REPO_ROOT / "data" / "vendsoft" / "raw" / "LATEST").write_text(stamp, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
