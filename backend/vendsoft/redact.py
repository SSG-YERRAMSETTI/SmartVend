"""Redaction applied before any VendSoft response touches disk.

Two independent concerns:

1. Response payloads may carry PII-adjacent fields (TelemetrySale.creditCard).
   Those are masked at the boundary, before persistence.
2. The API key must never appear in a log line, exception message, or report.
"""

from __future__ import annotations

from typing import Any

# Fields masked in every persisted record, matched case-insensitively.
SENSITIVE_FIELDS = frozenset(
    {
        "creditcard",
        "cardnumber",
        "card_number",
        "pan",
        "cvv",
        "apikey",
        "api_key",
        "password",
        "token",
        "authorization",
    }
)

MASK = "<redacted>"


def _mask_value(value: Any) -> Any:
    """Mask a value while preserving whether it was present and non-empty.

    Distinguishing null / empty / populated matters for the completeness
    analysis, so we keep that signal without keeping the data.
    """
    if value is None:
        return None
    if isinstance(value, str) and value == "":
        return ""
    return MASK


def redact_record(obj: Any) -> Any:
    """Recursively mask sensitive fields in a decoded JSON structure."""
    if isinstance(obj, dict):
        return {
            k: (_mask_value(v) if k.lower() in SENSITIVE_FIELDS else redact_record(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [redact_record(v) for v in obj]
    return obj


def redact_records(records: list[Any]) -> list[Any]:
    return [redact_record(r) for r in records]


def scrub_secret(text: str, secret: str | None) -> str:
    """Remove a secret from arbitrary text (log lines, exception messages).

    Also scrubs the common header spellings in case a library echoes them back.
    """
    if not text:
        return text
    out = text
    if secret:
        out = out.replace(secret, MASK)
    for header in ("x-api-key", "X-API-KEY", "X-Api-Key", "Authorization", "authorization"):
        # Collapse "header: value" into "header: <redacted>" regardless of value.
        idx = 0
        while True:
            i = out.find(header + ":", idx)
            if i == -1:
                break
            start = i + len(header) + 1
            end = out.find("\n", start)
            if end == -1:
                end = len(out)
            out = out[:start] + f" {MASK}" + out[end:]
            idx = start + len(MASK)
    return out
