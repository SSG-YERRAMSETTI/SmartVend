"""Read-only full-tenant extraction with adaptive sales-window discovery.

Strategy
--------
1. Pull the three unparameterised collections: products, locations, machines.
2. Pull one planogram per machine.
3. Probe sales windows on a representative machine to learn the API's limits:
   window ceiling, response cap, and how far back history goes.
4. Extract sales per machine by recursive bisection: request the widest window,
   and split only when the response looks capped. This minimises request count
   while still detecting truncation, because a parent whose children sum to more
   than the parent *proves* the parent was truncated.
5. Deduplicate by transactionId and record the observed time span.

Every request is sequential and paced. Nothing is ever written to VendSoft.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from .client import VendSoftAuthError, VendSoftError, VendSoftRateLimit, VendSoftReadClient
from .redact import redact_records
from .schemas import parse_transaction_time

log = logging.getLogger("vendsoft.extract")

# Counts that commonly indicate a server-side page/response cap.
SUSPICIOUS_ROUND_COUNTS = frozenset(
    {50, 100, 200, 250, 500, 1000, 1024, 2000, 2500, 5000, 10000}
)

# Lookbacks probed during discovery, in days.
PROBE_LOOKBACKS_DAYS = (1, 7, 30, 90, 365, 730, 1825)

# Never bisect below this; a 1-day window is the practical floor.
MIN_WINDOW = timedelta(days=1)


@dataclass
class DiscoveryResult:
    probe_machine: str | None = None
    probes: list[dict[str, Any]] = field(default_factory=list)
    max_window_days_ok: int | None = None
    suspected_cap: int | None = None
    cap_evidence: list[str] = field(default_factory=list)
    history_extends_beyond_probe: bool = False
    earliest_seen: str | None = None
    latest_seen: str | None = None
    unbounded_request_supported: bool | None = None
    unbounded_count: int | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "probe_machine": self.probe_machine,
            "probes": self.probes,
            "max_window_days_ok": self.max_window_days_ok,
            "suspected_cap": self.suspected_cap,
            "cap_evidence": self.cap_evidence,
            "history_extends_beyond_probe": self.history_extends_beyond_probe,
            "earliest_seen": self.earliest_seen,
            "latest_seen": self.latest_seen,
            "unbounded_request_supported": self.unbounded_request_supported,
            "unbounded_count": self.unbounded_count,
            "notes": self.notes,
        }


@dataclass
class SalesFetchResult:
    machine_code: str
    sales: list[dict[str, Any]] = field(default_factory=list)
    windows_used: list[dict[str, Any]] = field(default_factory=list)
    truncation_events: list[dict[str, Any]] = field(default_factory=list)
    duplicate_transaction_ids_across_windows: int = 0
    error: str | None = None


class ExtractionAborted(RuntimeError):
    """Raised when the run must stop (rate limit, auth failure, budget)."""


class TenantExtractor:
    def __init__(
        self,
        client: VendSoftReadClient,
        out_dir: Path,
        *,
        history_days: int = 1825,
        max_requests: int = 1200,
        progress: Callable[[str], None] | None = None,
    ) -> None:
        self.client = client
        self.out_dir = out_dir
        self.history_days = history_days
        self.max_requests = max_requests
        self.progress = progress or (lambda m: None)
        self.now = datetime.now().replace(microsecond=0)
        self.aborted_reason: str | None = None

    # ---------------- helpers ----------------

    def _budget_check(self) -> None:
        if len(self.client.requests_made) >= self.max_requests:
            raise ExtractionAborted(
                f"request budget of {self.max_requests} exhausted; stopping to stay safe"
            )

    def _write(self, rel: str, payload: Any) -> None:
        path = self.out_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

    @staticmethod
    def _safe_name(code: str) -> str:
        return "".join(c if c.isalnum() or c in "-_." else "_" for c in str(code))[:120]

    # ---------------- collections ----------------

    def fetch_collections(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for name, fn in (
            ("products", self.client.get_products),
            ("locations", self.client.get_locations),
            ("machines", self.client.get_machines),
        ):
            self._budget_check()
            self.progress(f"GET /{name}")
            try:
                data = fn()
                out[name] = data if isinstance(data, list) else []
                if not isinstance(data, list):
                    out.setdefault("_errors", {})[name] = (
                        f"expected array, got {type(data).__name__}"
                    )
            except (VendSoftRateLimit, VendSoftAuthError):
                raise
            except VendSoftError as exc:
                out[name] = []
                out.setdefault("_errors", {})[name] = str(exc)
            self._write(f"{name}.json", redact_records(out.get(name, [])))
        return out

    def fetch_planograms(self, machine_codes: list[str]) -> dict[str, Any]:
        planograms: dict[str, list[dict[str, Any]]] = {}
        errors: dict[str, str] = {}
        for i, code in enumerate(machine_codes, 1):
            self._budget_check()
            self.progress(f"planogram {i}/{len(machine_codes)}: {code}")
            try:
                data = self.client.get_planogram(code)
                planograms[code] = data if isinstance(data, list) else []
            except (VendSoftRateLimit, VendSoftAuthError):
                raise
            except VendSoftError as exc:
                errors[code] = str(exc)
                planograms[code] = []
            self._write(
                f"planograms/{self._safe_name(code)}.json",
                redact_records(planograms[code]),
            )
        return {"planograms": planograms, "errors": errors}

    # ---------------- sales window discovery ----------------

    def discover_sales_limits(self, machine_codes: list[str]) -> DiscoveryResult:
        """Probe one machine with progressively larger windows."""
        res = DiscoveryResult()

        probe_code = self._pick_probe_machine(machine_codes, res)
        if probe_code is None:
            res.notes.append(
                "No machine returned sales in a 90-day probe; window limits could "
                "not be characterised from live data."
            )
            return res
        res.probe_machine = probe_code

        # Unbounded request: are fromDate/toDate genuinely optional?
        self._budget_check()
        self.progress(f"probe: unbounded sales for {probe_code}")
        try:
            data = self.client.get_sales(probe_code)
            res.unbounded_request_supported = True
            res.unbounded_count = len(data) if isinstance(data, list) else None
            res.probes.append(
                {"window": "unbounded", "days": None, "count": res.unbounded_count}
            )
        except (VendSoftRateLimit, VendSoftAuthError):
            raise
        except VendSoftError as exc:
            res.unbounded_request_supported = False
            res.probes.append({"window": "unbounded", "days": None, "error": str(exc)})

        counts: dict[int, int] = {}
        for days in PROBE_LOOKBACKS_DAYS:
            self._budget_check()
            self.progress(f"probe: {days}d window for {probe_code}")
            start = self.now - timedelta(days=days)
            try:
                data = self.client.get_sales(probe_code, start, self.now)
                n = len(data) if isinstance(data, list) else 0
                counts[days] = n
                res.max_window_days_ok = days
                probe = {"window": f"{days}d", "days": days, "count": n}
                spans = self._time_span(data if isinstance(data, list) else [])
                probe["earliest"] = spans[0]
                probe["latest"] = spans[1]
                res.probes.append(probe)
            except (VendSoftRateLimit, VendSoftAuthError):
                raise
            except VendSoftError as exc:
                res.probes.append({"window": f"{days}d", "days": days, "error": str(exc)})
                res.notes.append(f"{days}-day window failed: {exc}")
                break

        # Cap detection: identical counts across strictly increasing windows.
        ordered = sorted(counts.items())
        for (d1, c1), (d2, c2) in zip(ordered, ordered[1:]):
            if c1 == c2 and c1 > 0:
                res.cap_evidence.append(
                    f"{d1}d and {d2}d windows both returned {c1} records "
                    "(identical counts across increasing windows)"
                )
        plateau_values = [
            c for (_, c), (_, c2) in zip(ordered, ordered[1:]) if c == c2 and c > 0
        ]
        if plateau_values:
            res.suspected_cap = max(plateau_values)
        largest = ordered[-1][1] if ordered else 0
        if largest in SUSPICIOUS_ROUND_COUNTS:
            res.cap_evidence.append(
                f"largest probe returned exactly {largest} records, a common cap value"
            )
            res.suspected_cap = res.suspected_cap or largest

        # How far back does history actually go?
        #
        # A rising count at the widest window is NOT by itself evidence that
        # history is being clipped. What matters is whether the earliest record
        # returned sits near the window's opening edge. If the window opens well
        # before the earliest record and that leading stretch came back empty,
        # history genuinely starts at the earliest record.
        if ordered:
            max_days, max_count = ordered[-1]
            if max_days == max(PROBE_LOOKBACKS_DAYS) and max_count > 0:
                widest = next(
                    (p for p in res.probes if p.get("days") == max_days), None
                )
                earliest_iso = (widest or {}).get("earliest")
                lead_gap_days = None
                if earliest_iso:
                    window_start = self.now - timedelta(days=max_days)
                    lead_gap_days = (
                        datetime.fromisoformat(earliest_iso) - window_start
                    ).days

                if lead_gap_days is not None and lead_gap_days > 60:
                    res.history_extends_beyond_probe = False
                    res.notes.append(
                        f"widest probe window opened {lead_gap_days} days before the "
                        f"earliest record ({earliest_iso}) and that leading period was "
                        "empty; sales history starts at the earliest record and is "
                        "NOT clipped by the window"
                    )
                else:
                    res.history_extends_beyond_probe = True
                    res.notes.append(
                        f"earliest record sits within {lead_gap_days} days of the "
                        f"{max_days}d window edge; history may predate the probe "
                        "window — widen and re-probe"
                    )

        spans = [p for p in res.probes if p.get("earliest")]
        if spans:
            res.earliest_seen = min(p["earliest"] for p in spans)
            res.latest_seen = max(p["latest"] for p in spans if p.get("latest"))

        return res

    def _pick_probe_machine(
        self, machine_codes: list[str], res: DiscoveryResult
    ) -> str | None:
        """Find a machine with recent sales, trying at most a handful."""
        for code in machine_codes[:5]:
            self._budget_check()
            self.progress(f"probe: looking for a machine with sales ({code})")
            try:
                data = self.client.get_sales(
                    code, self.now - timedelta(days=90), self.now
                )
            except (VendSoftRateLimit, VendSoftAuthError):
                raise
            except VendSoftError as exc:
                res.notes.append(f"probe candidate {code} failed: {exc}")
                continue
            if isinstance(data, list) and data:
                res.notes.append(
                    f"probe machine {code} selected ({len(data)} sales in last 90d)"
                )
                return code
        return machine_codes[0] if machine_codes else None

    @staticmethod
    def _time_span(rows: list[dict[str, Any]]) -> tuple[str | None, str | None]:
        stamps = [
            parse_transaction_time(r.get("transactionTime"))
            for r in rows
            if isinstance(r, dict)
        ]
        stamps = [s for s in stamps if s]
        if not stamps:
            return None, None
        return min(stamps).isoformat(), max(stamps).isoformat()

    # ---------------- adaptive sales extraction ----------------

    def fetch_sales_for_machine(
        self, machine_code: str, discovery: DiscoveryResult
    ) -> SalesFetchResult:
        result = SalesFetchResult(machine_code=machine_code)
        seen: dict[Any, dict[str, Any]] = {}
        dup_count = 0
        no_id: list[dict[str, Any]] = []

        cap = discovery.suspected_cap

        def absorb(rows: list[dict[str, Any]]) -> None:
            nonlocal dup_count
            for r in rows:
                if not isinstance(r, dict):
                    continue
                tid = r.get("transactionId")
                if tid is None:
                    no_id.append(r)
                    continue
                if tid in seen:
                    dup_count += 1
                else:
                    seen[tid] = r

        def fetch(start: datetime, end: datetime, depth: int) -> int:
            self._budget_check()
            window_days = (end - start).days
            self.progress(
                f"sales {machine_code}: {start:%Y-%m-%d} -> {end:%Y-%m-%d} "
                f"({window_days}d, depth {depth})"
            )
            try:
                data = self.client.get_sales(machine_code, start, end)
            except (VendSoftRateLimit, VendSoftAuthError):
                raise
            except VendSoftError as exc:
                result.windows_used.append(
                    {
                        "from": start.isoformat(),
                        "to": end.isoformat(),
                        "days": window_days,
                        "error": str(exc),
                        "depth": depth,
                    }
                )
                return 0

            rows = data if isinstance(data, list) else []
            n = len(rows)
            result.windows_used.append(
                {
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "days": window_days,
                    "count": n,
                    "depth": depth,
                }
            )

            looks_capped = (cap is not None and n >= cap) or (
                n in SUSPICIOUS_ROUND_COUNTS and n > 0
            )
            can_split = (end - start) > MIN_WINDOW and depth < 8

            if looks_capped and can_split:
                # Bisect and compare: children summing above the parent proves
                # the parent response was truncated.
                mid = start + (end - start) / 2
                child_total = fetch(start, mid, depth + 1) + fetch(mid, end, depth + 1)
                if child_total > n:
                    result.truncation_events.append(
                        {
                            "from": start.isoformat(),
                            "to": end.isoformat(),
                            "parent_count": n,
                            "children_total": child_total,
                            "verdict": "CONFIRMED truncation: halves returned more "
                            "records than the parent window",
                        }
                    )
                else:
                    result.truncation_events.append(
                        {
                            "from": start.isoformat(),
                            "to": end.isoformat(),
                            "parent_count": n,
                            "children_total": child_total,
                            "verdict": "no truncation: halves matched the parent",
                        }
                    )
                    absorb(rows)
                return max(child_total, n)

            absorb(rows)
            return n

        start = self.now - timedelta(days=self.history_days)
        try:
            fetch(start, self.now, 0)
        except (VendSoftRateLimit, VendSoftAuthError):
            raise
        except ExtractionAborted as exc:
            result.error = str(exc)

        result.sales = list(seen.values()) + no_id
        result.duplicate_transaction_ids_across_windows = dup_count
        if no_id:
            result.truncation_events.append(
                {
                    "verdict": f"{len(no_id)} sales rows had no transactionId and "
                    "could not be deduplicated"
                }
            )
        return result

    # ---------------- orchestration ----------------

    def run(self) -> dict[str, Any]:
        manifest: dict[str, Any] = {
            "started_at": self.now.isoformat(),
            "base_url": self.client.config.base_url,
            "api_key_fingerprint": self.client.config.key_fingerprint,
            "history_days": self.history_days,
            "aborted": None,
        }

        try:
            collections = self.fetch_collections()
            machines = collections.get("machines", [])
            machine_codes = [
                m.get("machineCode")
                for m in machines
                if isinstance(m, dict) and m.get("machineCode")
            ]

            plan = self.fetch_planograms(machine_codes)
            discovery = self.discover_sales_limits(machine_codes)
            self._write("_discovery.json", discovery.to_dict())

            sales_by_machine: dict[str, SalesFetchResult] = {}
            for i, code in enumerate(machine_codes, 1):
                self.progress(f"sales {i}/{len(machine_codes)}: {code}")
                r = self.fetch_sales_for_machine(code, discovery)
                sales_by_machine[code] = r
                self._write(
                    f"sales/{self._safe_name(code)}.json",
                    {
                        "machineCode": code,
                        "windows_used": r.windows_used,
                        "truncation_events": r.truncation_events,
                        "duplicates_across_windows": r.duplicate_transaction_ids_across_windows,
                        "sales": redact_records(r.sales),
                    },
                )

        except VendSoftRateLimit as exc:
            manifest["aborted"] = f"RATE LIMITED — {exc}"
            self._finalize(manifest)
            raise ExtractionAborted(manifest["aborted"]) from None
        except VendSoftAuthError as exc:
            manifest["aborted"] = f"AUTH FAILED — {exc}"
            self._finalize(manifest)
            raise ExtractionAborted(manifest["aborted"]) from None
        except ExtractionAborted as exc:
            manifest["aborted"] = str(exc)
            self._finalize(manifest)
            raise

        manifest["finished_at"] = datetime.now().isoformat()
        self._finalize(manifest)

        return {
            "manifest": manifest,
            "products": collections.get("products", []),
            "locations": collections.get("locations", []),
            "machines": machines,
            "collection_errors": collections.get("_errors", {}),
            "planograms": plan["planograms"],
            "planogram_errors": plan["errors"],
            "discovery": discovery,
            "sales": sales_by_machine,
        }

    def _finalize(self, manifest: dict[str, Any]) -> None:
        self._write("_manifest.json", manifest)
        self._write(
            "_requests.json",
            [r.to_dict() for r in self.client.requests_made],
        )
