"""Redaction and schema-parsing tests."""

from datetime import datetime

from vendsoft.redact import MASK, redact_record, redact_records, scrub_secret
from vendsoft.schemas import (
    Column,
    Location,
    Machine,
    Product,
    TelemetrySale,
    collect_extra_fields,
    format_dt,
    parse_many,
    parse_transaction_time,
)


# ---------- redaction ----------


def test_credit_card_is_masked():
    row = {"transactionId": 1, "creditCard": "4111111111111111", "price": 1.5}
    out = redact_record(row)
    assert out["creditCard"] == MASK
    assert "4111111111111111" not in str(out)
    assert out["transactionId"] == 1
    assert out["price"] == 1.5


def test_redaction_preserves_null_and_empty_signal():
    assert redact_record({"creditCard": None})["creditCard"] is None
    assert redact_record({"creditCard": ""})["creditCard"] == ""
    assert redact_record({"creditCard": "x"})["creditCard"] == MASK


def test_redaction_is_case_insensitive_and_recursive():
    row = {"a": {"CreditCard": "x", "b": [{"CREDITCARD": "y"}]}}
    out = redact_record(row)
    assert out["a"]["CreditCard"] == MASK
    assert out["a"]["b"][0]["CREDITCARD"] == MASK


def test_other_sensitive_keys_masked():
    row = {"api_key": "k", "password": "p", "token": "t", "authorization": "a"}
    out = redact_record(row)
    assert all(v == MASK for v in out.values())


def test_redact_records_list():
    rows = [{"creditCard": "a"}, {"creditCard": "b"}]
    assert [r["creditCard"] for r in redact_records(rows)] == [MASK, MASK]


def test_scrub_secret_removes_value_and_header():
    secret = "SUPERSECRET"
    text = f"error: {secret}\nx-api-key: {secret}\nnext line"
    out = scrub_secret(text, secret)
    assert secret not in out


def test_scrub_secret_handles_empty():
    assert scrub_secret("", "k") == ""
    assert scrub_secret("hello", None) == "hello"


# ---------- schemas ----------


def test_product_parses():
    p = Product.model_validate(
        {
            "productCode": "P1",
            "productName": "Cola",
            "productType": "Soda",
            "barcode": "012",
            "unitsPerCase": 24,
            "lastCost": 0.55,
            "averageCost": 0.52,
        }
    )
    assert p.productCode == "P1"
    assert p.unitsPerCase == 24
    assert p.extra_fields() == set()


def test_machine_location_column_parse():
    m = Machine.model_validate({"machineCode": "M1", "machineType": "Snack"})
    assert m.machineCode == "M1"
    loc = Location.model_validate({"locationCode": "L1", "city": "Denton"})
    assert loc.city == "Denton"
    col = Column.model_validate({"column": "A1", "vendPrice": 1.25, "maxCapacity": 10})
    assert col.column == "A1"
    assert col.vendPrice == 1.25


def test_undocumented_fields_are_preserved_and_reported():
    p = Product.model_validate({"productCode": "P1", "somethingNew": 42})
    assert p.extra_fields() == {"somethingNew"}
    assert collect_extra_fields([p]) == {"somethingNew"}


def test_telemetry_sale_parses_and_tolerates_missing_required():
    s = TelemetrySale.model_validate({"transactionId": 5})
    assert s.transactionId == 5
    assert s.telemetryId is None  # tolerated, reported later as missing


def test_parse_many_collects_errors_without_raising():
    rows, errs = parse_many(Product, [{"productCode": "A"}, {"unitsPerCase": "not-int"}])
    assert len(rows) == 1
    assert len(errs) == 1
    assert "row 1" in errs[0]


def test_parse_many_rejects_non_array():
    rows, errs = parse_many(Product, {"productCode": "A"})
    assert rows == []
    assert "expected a JSON array" in errs[0]


def test_format_dt_matches_vendsoft_format():
    assert format_dt(datetime(2026, 3, 4, 5, 6, 7)) == "20260304050607"


def test_parse_transaction_time_handles_plausible_formats():
    expected = datetime(2026, 3, 4, 5, 6, 7)
    for raw in (
        "20260304050607",
        "2026-03-04T05:06:07",
        "2026-03-04 05:06:07",
        "03/04/2026 05:06:07",
    ):
        assert parse_transaction_time(raw) == expected, raw
    assert parse_transaction_time("2026-03-04").date() == expected.date()
    assert parse_transaction_time("garbage") is None
    assert parse_transaction_time(None) is None
