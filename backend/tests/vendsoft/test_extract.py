"""Extraction orchestration: dedup, cap detection, bisection, truncation proof."""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from vendsoft.extract import DiscoveryResult, TenantExtractor
from vendsoft.schemas import format_dt


class FakeVendSoft:
    """A simulated tenant. `cap` mimics a server-side response limit."""

    def __init__(self, machines, sales_by_machine, cap=None, planograms=None):
        self._machines = machines
        self._sales = sales_by_machine
        self.cap = cap
        self._planograms = planograms or {}
        self.requests_made = []
        self.config = type(
            "C", (), {"base_url": "https://example.invalid", "key_fingerprint": "test0000"}
        )()
        self.sales_calls = []

    def _record(self):
        # Mirrors client.RequestRecord's only contract used by the extractor.
        self.requests_made.append(SimpleNamespace(to_dict=lambda: {"path": "fake"}))

    def get_products(self):
        self._record()
        return [{"productCode": "P1", "productName": "Cola"}]

    def get_locations(self):
        self._record()
        return [{"locationCode": "L1", "locationName": "HQ"}]

    def get_machines(self):
        self._record()
        return self._machines

    def get_planogram(self, code):
        self._record()
        return self._planograms.get(code, [])

    def get_sales(self, code, from_date=None, to_date=None):
        self._record()
        self.sales_calls.append((code, from_date, to_date))
        rows = self._sales.get(code, [])
        if from_date and to_date:
            rows = [
                r
                for r in rows
                if from_date <= datetime.strptime(r["transactionTime"], "%Y%m%d%H%M%S") < to_date
            ]
        if self.cap is not None:
            rows = rows[: self.cap]
        return list(rows)


def _sale(i, when):
    return {
        "telemetryId": f"T{i}",
        "transactionId": i,
        "transactionTime": format_dt(when),
        "machineCode": "M1",
        "productCode": "P1",
        "creditCard": "4111111111111111",
        "quantity": 1,
        "price": 1.25,
    }


def _spread(n, days_back_start, now):
    """n sales spread evenly across the window ending at `now`.

    Offsets use (i - 1) so the last sale lands strictly before `now`; the API
    filter is half-open [from, to), so a sale exactly at `now` would be excluded.
    """
    return [
        _sale(i, now - timedelta(days=days_back_start) + timedelta(
            seconds=int((i - 1) * days_back_start * 86400 / max(n, 1))
        ))
        for i in range(1, n + 1)
    ]


@pytest.fixture
def now():
    return datetime(2026, 8, 4, 12, 0, 0)


def _extractor(client, tmp_path, now, **kw):
    e = TenantExtractor(client, tmp_path, progress=lambda m: None, **kw)
    e.now = now
    return e


# ---------- dedup ----------


def test_sales_deduplicated_by_transaction_id(tmp_path, now):
    sales = _spread(10, 300, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales})
    e = _extractor(fake, tmp_path, now, history_days=365)
    r = e.fetch_sales_for_machine("M1", DiscoveryResult())
    assert len(r.sales) == 10
    assert len({s["transactionId"] for s in r.sales}) == 10


def test_duplicates_across_windows_are_counted(tmp_path, now):
    """A capped response forces bisection; overlapping rows must be deduped."""
    sales = _spread(100, 300, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales}, cap=100)
    e = _extractor(fake, tmp_path, now, history_days=365)
    disc = DiscoveryResult(suspected_cap=100)
    r = e.fetch_sales_for_machine("M1", disc)
    # All 100 recovered exactly once despite multiple overlapping windows.
    assert len({s["transactionId"] for s in r.sales}) == 100


# ---------- truncation detection ----------


def test_bisection_proves_truncation_when_capped(tmp_path, now):
    """250 sales behind a 100-row cap: children must exceed the parent."""
    sales = _spread(250, 300, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales}, cap=100)
    e = _extractor(fake, tmp_path, now, history_days=365)
    disc = DiscoveryResult(suspected_cap=100)
    r = e.fetch_sales_for_machine("M1", disc)

    confirmed = [
        t for t in r.truncation_events if "CONFIRMED truncation" in t.get("verdict", "")
    ]
    assert confirmed, "bisection failed to prove truncation"
    assert confirmed[0]["children_total"] > confirmed[0]["parent_count"]
    # Recovery should beat the cap substantially.
    assert len(r.sales) > 100


def test_no_bisection_when_response_is_small(tmp_path, now):
    sales = _spread(7, 300, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales})
    e = _extractor(fake, tmp_path, now, history_days=365)
    r = e.fetch_sales_for_machine("M1", DiscoveryResult())
    assert len(r.windows_used) == 1, "small response must not trigger splitting"
    assert not r.truncation_events


def test_suspicious_round_count_triggers_verification(tmp_path, now):
    """Exactly 100 rows with no cap: split to verify, then confirm no truncation."""
    sales = _spread(100, 300, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales}, cap=None)
    e = _extractor(fake, tmp_path, now, history_days=365)
    r = e.fetch_sales_for_machine("M1", DiscoveryResult())
    assert len(r.windows_used) > 1, "round count should trigger a verification split"
    assert any("no truncation" in t.get("verdict", "") for t in r.truncation_events)
    assert len(r.sales) == 100


def test_machine_with_no_sales(tmp_path, now):
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": []})
    e = _extractor(fake, tmp_path, now, history_days=365)
    r = e.fetch_sales_for_machine("M1", DiscoveryResult())
    assert r.sales == []
    assert not r.truncation_events


def test_sales_without_transaction_id_are_kept_and_flagged(tmp_path, now):
    rows = [{"telemetryId": "T1", "transactionTime": format_dt(now - timedelta(days=1))}]
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": rows})
    e = _extractor(fake, tmp_path, now, history_days=365)
    r = e.fetch_sales_for_machine("M1", DiscoveryResult())
    assert len(r.sales) == 1
    assert any("no transactionId" in t.get("verdict", "") for t in r.truncation_events)


# ---------- discovery ----------


def test_discovery_detects_cap_from_plateau(tmp_path, now):
    sales = _spread(5000, 1800, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales}, cap=500)
    e = _extractor(fake, tmp_path, now)
    disc = e.discover_sales_limits(["M1"])
    assert disc.suspected_cap == 500
    assert disc.cap_evidence


def test_discovery_records_probe_ladder(tmp_path, now):
    sales = _spread(50, 1000, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales})
    e = _extractor(fake, tmp_path, now)
    disc = e.discover_sales_limits(["M1"])
    windows = [p["window"] for p in disc.probes]
    assert "unbounded" in windows
    for d in (1, 7, 30, 90, 365, 730, 1825):
        assert f"{d}d" in windows


def test_discovery_handles_tenant_with_no_sales(tmp_path, now):
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": []})
    e = _extractor(fake, tmp_path, now)
    disc = e.discover_sales_limits(["M1"])
    assert disc.suspected_cap is None


# ---------- budget and persistence ----------


def test_request_budget_aborts(tmp_path, now):
    from vendsoft.extract import ExtractionAborted

    sales = _spread(50, 300, now)
    fake = FakeVendSoft([{"machineCode": "M1"}], {"M1": sales})
    e = _extractor(fake, tmp_path, now, max_requests=1)
    fake.requests_made = [object(), object()]
    with pytest.raises(ExtractionAborted):
        e.fetch_collections()


def test_persisted_sales_are_redacted(tmp_path, now):
    import json

    sales = _spread(3, 10, now)
    fake = FakeVendSoft(
        [{"machineCode": "M1"}], {"M1": sales}, planograms={"M1": [{"column": "A1"}]}
    )
    e = _extractor(fake, tmp_path, now, history_days=30)
    e.run()
    written = (tmp_path / "sales" / "M1.json").read_text(encoding="utf-8")
    assert "4111111111111111" not in written
    assert "<redacted>" in written
    payload = json.loads(written)
    assert payload["sales"][0]["creditCard"] == "<redacted>"
    # Raw collections were written too.
    assert (tmp_path / "products.json").exists()
    assert (tmp_path / "machines.json").exists()
    assert (tmp_path / "_manifest.json").exists()
    assert (tmp_path / "_discovery.json").exists()


def test_rate_limit_aborts_run(tmp_path, now):
    from vendsoft.client import VendSoftRateLimit
    from vendsoft.extract import ExtractionAborted

    class RateLimited(FakeVendSoft):
        def get_machines(self):
            raise VendSoftRateLimit("GET /machines returned 429")

    fake = RateLimited([], {})
    e = _extractor(fake, tmp_path, now)
    with pytest.raises(ExtractionAborted) as ei:
        e.run()
    assert "RATE LIMITED" in str(ei.value)
    assert (tmp_path / "_manifest.json").exists()
