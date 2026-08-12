"""Safety and behaviour tests for the read-only client."""

import time

import pytest

from vendsoft import client as vsclient
from vendsoft.client import (
    VendSoftAuthError,
    VendSoftError,
    VendSoftRateLimit,
    VendSoftReadClient,
)
from vendsoft.config import VendSoftConfig
from helpers import FAKE_KEY, FakeResponse, FakeSession

WRITE_VERBS = ("post", "put", "patch", "delete", "request", "head", "options")


# ---------- structural read-only guarantees ----------


def test_client_exposes_no_write_verbs():
    for verb in WRITE_VERBS:
        assert not hasattr(VendSoftReadClient, verb), f"client exposes {verb}"


def test_get_only_session_exposes_only_get_and_close():
    s = vsclient._GetOnlySession()
    try:
        public = {m for m in dir(s) if not m.startswith("_")}
        assert public == {"get", "close"}
        for verb in WRITE_VERBS:
            assert not hasattr(s, verb)
    finally:
        s.close()


def test_get_only_session_has_no_public_accessor_for_underlying_session():
    s = vsclient._GetOnlySession()
    try:
        assert s.__slots__ == ("_session",)
        assert not hasattr(s, "__dict__")  # slots prevent attribute injection
    finally:
        s.close()


def test_source_contains_no_write_calls():
    """Guard against a future edit reintroducing a write path."""
    import inspect

    src = inspect.getsource(vsclient)
    for bad in (".post(", ".put(", ".patch(", ".delete(", "session.request("):
        assert bad not in src, f"client source contains {bad}"


# ---------- request construction ----------


def test_api_key_sent_as_header_never_in_url(make_client):
    c = make_client([FakeResponse(200, [])])
    c.get_products()
    call = c._http.calls[0]
    assert call["headers"]["x-api-key"] == FAKE_KEY
    assert FAKE_KEY not in call["url"]
    assert FAKE_KEY not in str(call.get("params") or {})
    assert call["url"] == "https://example.invalid/api/v2/products"


def test_all_five_documented_endpoints(make_client):
    from datetime import datetime

    c = make_client([FakeResponse(200, []) for _ in range(5)])
    c.get_products()
    c.get_machines()
    c.get_locations()
    c.get_planogram("M-1")
    c.get_sales("M-1", datetime(2026, 1, 1), datetime(2026, 2, 1))

    urls = [x["url"] for x in c._http.calls]
    assert urls == [
        "https://example.invalid/api/v2/products",
        "https://example.invalid/api/v2/machines",
        "https://example.invalid/api/v2/locations",
        "https://example.invalid/api/v2/machines/M-1/planogram",
        "https://example.invalid/api/v2/machines/M-1/sales",
    ]
    assert c._http.calls[-1]["params"] == {
        "fromDate": "20260101000000",
        "toDate": "20260201000000",
    }


def test_machine_code_is_url_quoted(make_client):
    c = make_client([FakeResponse(200, [])])
    c.get_planogram("M/1 A")
    assert c._http.calls[0]["url"].endswith("/machines/M%2F1%20A/planogram")


def test_none_params_are_dropped(make_client):
    c = make_client([FakeResponse(200, [])])
    c.get_sales("M-1")
    assert c._http.calls[0]["params"] == {}


# ---------- error handling ----------


def test_429_raises_rate_limit_immediately_without_retry(make_client):
    c = make_client(
        [FakeResponse(429, None, {"Retry-After": "120"}, text="slow down")]
    )
    with pytest.raises(VendSoftRateLimit) as ei:
        c.get_products()
    assert "429" in str(ei.value)
    assert len(c._http.calls) == 1, "429 must not be retried"


@pytest.mark.parametrize("status", [401, 403])
def test_auth_errors_raise_and_do_not_retry(make_client, status):
    c = make_client([FakeResponse(status, None, text="denied")])
    with pytest.raises(VendSoftAuthError):
        c.get_products()
    assert len(c._http.calls) == 1


def test_500_retries_then_raises(make_client):
    c = make_client([FakeResponse(500, None, text="boom") for _ in range(3)])
    with pytest.raises(VendSoftError):
        c.get_products()
    assert len(c._http.calls) == 3


def test_500_then_success_recovers(make_client):
    c = make_client([FakeResponse(500, None, text="boom"), FakeResponse(200, [{"a": 1}])])
    assert c.get_products() == [{"a": 1}]


def test_non_json_body_raises_clean_error(make_client):
    c = make_client([FakeResponse(200, None, text="<html>nope</html>")])
    with pytest.raises(VendSoftError) as ei:
        c.get_products()
    assert "non-JSON" in str(ei.value)


def test_400_surfaces_message(make_client):
    c = make_client([FakeResponse(400, None, text='{"message":"Invalid request"}')])
    with pytest.raises(VendSoftError) as ei:
        c.get_products()
    assert "400" in str(ei.value)


# ---------- secret hygiene ----------


def test_key_never_appears_in_exception_text(make_client):
    leaky = f"failure for key {FAKE_KEY} with x-api-key: {FAKE_KEY}"
    c = make_client([FakeResponse(400, None, text=leaky)])
    with pytest.raises(VendSoftError) as ei:
        c.get_products()
    assert FAKE_KEY not in str(ei.value)


def test_key_never_appears_in_request_audit_log(make_client):
    leaky = f"boom {FAKE_KEY}"
    c = make_client([FakeResponse(400, None, text=leaky)])
    with pytest.raises(VendSoftError):
        c.get_products()
    dumped = str([r.to_dict() for r in c.requests_made])
    assert FAKE_KEY not in dumped


def test_config_repr_does_not_leak_key(config):
    assert FAKE_KEY not in repr(config)
    assert FAKE_KEY not in str(config)
    assert "<redacted>" in repr(config)


def test_client_repr_does_not_leak_key(make_client):
    c = make_client([])
    assert FAKE_KEY not in repr(c)


def test_key_fingerprint_is_stable_and_not_the_key(config):
    fp = config.key_fingerprint
    assert fp == config.key_fingerprint
    assert len(fp) == 12
    assert FAKE_KEY not in fp


# ---------- pacing and audit ----------


def test_min_interval_is_enforced():
    cfg = VendSoftConfig(
        base_url="https://example.invalid/api/v2",
        api_key=FAKE_KEY,
        min_interval_s=0.25,
        backoff_base_s=0.0,
    )
    c = VendSoftReadClient(cfg)
    c._http = FakeSession([FakeResponse(200, []), FakeResponse(200, [])])
    t0 = time.monotonic()
    c.get_products()
    c.get_machines()
    assert time.monotonic() - t0 >= 0.25


def test_request_records_capture_counts_and_headers(make_client):
    c = make_client(
        [
            FakeResponse(
                200,
                [{"a": 1}, {"a": 2}],
                {"Content-Type": "application/json", "X-Total-Count": "2"},
            )
        ]
    )
    c.get_products()
    rec = c.requests_made[0]
    assert rec.status == 200
    assert rec.record_count == 2
    assert rec.path == "/products"
    assert rec.headers.get("X-Total-Count") == "2"


def test_missing_credentials_message_has_no_value(monkeypatch, tmp_path):
    from vendsoft.config import MissingCredentials, load_config

    monkeypatch.setenv("VENDSOFT_API_KEY", "")
    with pytest.raises(MissingCredentials) as ei:
        load_config(env_path=tmp_path / "nonexistent.env")
    assert "VENDSOFT_API_KEY" in str(ei.value)
