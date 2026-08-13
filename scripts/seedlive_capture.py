"""Seed Live Test Transport capture harness. Development only.

Purpose: capture exactly what Cantaloupe / Seed Live sends over an HTTP
transport, so the provider contract can be established from evidence instead of
assumption.

This is NOT the production Cantaloupe route. It is deliberately:

- standalone, importing nothing from `backend/`
- free of any database, ORM, or application configuration
- unregistered anywhere in the application
- accepting of any request, because its whole job is to observe one

Never point a production Seed Live transport at this. It authenticates nothing.

Captured data is real customer business data. Everything is written under a
gitignored directory and nothing here is safe to commit.

Usage:

    python scripts/seedlive_capture.py                    # respond 200
    python scripts/seedlive_capture.py --status 202       # respond 202
    python scripts/seedlive_capture.py --fail-first 1     # 500 once, then 200

Each request produces one directory:

    data/seedlive/captures/<utc-timestamp>-<seq>/
        request.json   full metadata, INCLUDING header values. Sensitive.
        body.bin       the exact bytes received, unmodified
        summary.txt    redacted. Safe to read and share.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
DEFAULT_OUTDIR = Path("data/seedlive/captures")

#: Header values safe to show in the redacted summary. Everything else is
#: withheld by default, because we do not yet know which header Seed Live uses
#: to carry a credential or a signature. Withholding by default is the only
#: safe policy when the contract is unknown.
SHOWABLE_HEADER_VALUES = frozenset(
    {
        "accept",
        "accept-encoding",
        "connection",
        "content-disposition",
        "content-encoding",
        "content-length",
        "content-type",
        "date",
        "expect",
        "host",
        "transfer-encoding",
        "user-agent",
    }
)

MAX_BODY_BYTES = 200 * 1024 * 1024


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def fingerprint(value: str) -> str:
    """Short, non-reversible tag for a withheld value.

    Lets us see whether the same secret was sent on two deliveries without
    ever learning what it is.
    """
    return hashlib.sha256(value.encode("utf-8", "replace")).hexdigest()[:12]


def redact_headers(headers: list[tuple[str, str]]) -> list[str]:
    """Render headers for the summary.

    Every header NAME is shown, always: knowing that a signature or auth header
    exists is the point of this exercise. Values are shown only for the safe
    list; everything else becomes a length and a fingerprint.
    """
    lines = []
    for name, value in headers:
        lowered = name.lower()
        if lowered in SHOWABLE_HEADER_VALUES:
            lines.append(f"  {name}: {value}")
        else:
            lines.append(
                f"  {name}: <withheld len={len(value)} fp={fingerprint(value)}>"
            )
    return lines


def analyse_body(body: bytes, content_type: str | None) -> dict:
    """Structural facts about the payload. Never returns payload content.

    Field names from a delimited header row are content, so they are not
    included here either; they are extracted later from body.bin under review.
    """
    info: dict = {
        "size_bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
        "starts_with_utf8_bom": body[:3] == b"\xef\xbb\xbf",
        "starts_with_gzip_magic": body[:2] == b"\x1f\x8b",
        "starts_with_zip_magic": body[:2] == b"PK",
        "contains_crlf": b"\r\n" in body,
        "contains_lone_lf": b"\n" in body.replace(b"\r\n", b""),
        "line_count": body.count(b"\n"),
        "is_probably_multipart": bool(
            content_type and "multipart/" in content_type.lower()
        ),
    }

    if info["is_probably_multipart"] and content_type:
        boundary = None
        for part in content_type.split(";"):
            part = part.strip()
            if part.lower().startswith("boundary="):
                boundary = part[len("boundary=") :].strip('"')
        info["multipart_boundary_present"] = boundary is not None
        if boundary:
            # Record only part headers, never part bodies.
            marker = b"--" + boundary.encode("ascii", "replace")
            part_headers: list[str] = []
            for chunk in body.split(marker)[1:]:
                head = chunk.split(b"\r\n\r\n", 1)[0]
                for line in head.split(b"\r\n"):
                    text = line.decode("utf-8", "replace").strip()
                    if text and ":" in text:
                        part_headers.append(text)
            info["multipart_part_headers"] = part_headers[:40]

    try:
        body.decode("utf-8")
        info["decodes_as_utf8"] = True
    except UnicodeDecodeError:
        info["decodes_as_utf8"] = False

    return info


class CaptureHandler(BaseHTTPRequestHandler):
    server_version = "SeedLiveCapture/0.1"
    sys_version = ""

    # Configured by main().
    outdir: Path = DEFAULT_OUTDIR
    respond_status: int = 200
    fail_first: int = 0
    response_body: bytes = b""
    response_content_type: str | None = None
    seq: int = 0

    def _read_body(self) -> bytes:
        transfer_encoding = (self.headers.get("Transfer-Encoding") or "").lower()
        if "chunked" in transfer_encoding:
            chunks = []
            total = 0
            while True:
                line = self.rfile.readline().strip()
                if not line:
                    break
                try:
                    size = int(line.split(b";")[0], 16)
                except ValueError:
                    break
                if size == 0:
                    self.rfile.readline()
                    break
                total += size
                if total > MAX_BODY_BYTES:
                    raise ValueError("body exceeded the capture limit")
                chunks.append(self.rfile.read(size))
                self.rfile.readline()
            return b"".join(chunks)

        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY_BYTES:
            raise ValueError("body exceeded the capture limit")
        return self.rfile.read(length) if length else b""

    def _capture(self, method: str) -> None:
        cls = type(self)
        cls.seq += 1
        seq = cls.seq

        received_at = datetime.now(timezone.utc)
        try:
            body = self._read_body()
        except ValueError as exc:
            self.send_response(413)
            self.end_headers()
            print(f"[{seq}] rejected: {exc}", file=sys.stderr)
            return

        raw_path, _, query = self.path.partition("?")
        headers = [(k, v) for k, v in self.headers.items()]
        content_type = self.headers.get("Content-Type")

        status = 500 if seq <= cls.fail_first else cls.respond_status

        record = {
            "capture_seq": seq,
            "received_at": received_at.isoformat().replace("+00:00", "Z"),
            "client_ip": self.client_address[0],
            "request_line": self.requestline,
            "method": method,
            "raw_path": raw_path,
            "query_string": query,
            "http_version": self.request_version,
            "headers": [{"name": k, "value": v} for k, v in headers],
            "header_names_in_order": [k for k, _ in headers],
            "content_type": content_type,
            "content_disposition": self.headers.get("Content-Disposition"),
            "content_length_header": self.headers.get("Content-Length"),
            "transfer_encoding": self.headers.get("Transfer-Encoding"),
            "content_encoding": self.headers.get("Content-Encoding"),
            "body": analyse_body(body, content_type),
            "response_status_returned": status,
        }

        directory = cls.outdir / f"{received_at.strftime('%Y%m%dT%H%M%SZ')}-{seq:03d}"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "body.bin").write_bytes(body)
        (directory / "request.json").write_text(
            json.dumps(record, indent=2), encoding="utf-8", newline="\n"
        )
        (directory / "summary.txt").write_text(
            self._summary(record, headers), encoding="utf-8", newline="\n"
        )

        self.send_response(status)
        if cls.response_content_type:
            self.send_header("Content-Type", cls.response_content_type)
        self.send_header("Content-Length", str(len(cls.response_body)))
        self.end_headers()
        if cls.response_body:
            self.wfile.write(cls.response_body)

        print(
            f"[{seq}] {method} {raw_path}"
            f"{'?' + query if query else ''} "
            f"ct={content_type or '-'} "
            f"bytes={record['body']['size_bytes']} "
            f"sha256={record['body']['sha256'][:12]} "
            f"-> responded {status}",
            flush=True,
        )
        print(f"      saved: {directory}", flush=True)

    def _summary(self, record: dict, headers: list[tuple[str, str]]) -> str:
        body = record["body"]
        lines = [
            "Seed Live capture summary (redacted, safe to share)",
            "=" * 55,
            f"sequence          {record['capture_seq']}",
            f"received_at       {record['received_at']}",
            f"request line      {record['request_line']}",
            f"method            {record['method']}",
            f"path              {record['raw_path']}",
            f"query string      {record['query_string'] or '(none)'}",
            f"http version      {record['http_version']}",
            f"content-type      {record['content_type'] or '(none)'}",
            f"content-disp.     {record['content_disposition'] or '(none)'}",
            f"transfer-encoding {record['transfer_encoding'] or '(none)'}",
            f"content-encoding  {record['content_encoding'] or '(none)'}",
            f"response returned {record['response_status_returned']}",
            "",
            "headers (names always shown; unknown values withheld)",
            *redact_headers(headers),
            "",
            "body (structure only, no content)",
            f"  size_bytes        {body['size_bytes']}",
            f"  sha256            {body['sha256']}",
            f"  utf8 BOM          {body['starts_with_utf8_bom']}",
            f"  gzip magic        {body['starts_with_gzip_magic']}",
            f"  zip magic         {body['starts_with_zip_magic']}",
            f"  decodes as utf-8  {body['decodes_as_utf8']}",
            f"  contains CRLF     {body['contains_crlf']}",
            f"  contains lone LF  {body['contains_lone_lf']}",
            f"  line count        {body['line_count']}",
            f"  multipart         {body['is_probably_multipart']}",
        ]
        if body.get("multipart_part_headers"):
            lines.append("  multipart part headers:")
            lines.extend(f"    {h}" for h in body["multipart_part_headers"])
        lines += [
            "",
            "NOTE: body.bin holds real customer data. request.json holds full",
            "header values, which may include a credential. Neither is safe to",
            "commit or paste anywhere. Both live under a gitignored directory.",
            "",
            "This summary withholds unknown header values, but Content-Type and",
            "Content-Disposition are shown because a filename is the evidence we",
            "need for report identification. A filename can name a customer, so",
            "read it before sharing outside the team.",
        ]
        return "\n".join(lines) + "\n"

    # Every method is captured: we do not know what Seed Live sends.
    def do_POST(self) -> None:  # noqa: N802
        self._capture("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._capture("PUT")

    def do_GET(self) -> None:  # noqa: N802
        self._capture("GET")

    def do_HEAD(self) -> None:  # noqa: N802
        self._capture("HEAD")

    def do_PATCH(self) -> None:  # noqa: N802
        self._capture("PATCH")

    def log_message(self, format: str, *args) -> None:
        # Silenced: the default access log would echo the full request line to
        # stderr, and we print a controlled summary instead.
        return


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Capture a Seed Live Test Transport delivery. Development only."
    )
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument(
        "--status",
        type=int,
        default=200,
        help="HTTP status to return for captured requests (default: 200)",
    )
    parser.add_argument(
        "--fail-first",
        type=int,
        default=0,
        metavar="N",
        help="return 500 for the first N requests, to observe retry behavior",
    )
    parser.add_argument(
        "--body-text",
        default="",
        help="optional response body, to test whether the provider requires one",
    )
    parser.add_argument("--response-content-type", default=None)
    parser.add_argument("--outdir", type=Path, default=DEFAULT_OUTDIR)
    args = parser.parse_args(argv)

    outdir = args.outdir.resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    CaptureHandler.outdir = outdir
    CaptureHandler.respond_status = args.status
    CaptureHandler.fail_first = args.fail_first
    CaptureHandler.response_body = args.body_text.encode("utf-8")
    CaptureHandler.response_content_type = args.response_content_type

    server = ThreadingHTTPServer((args.host, args.port), CaptureHandler)
    print("Seed Live capture harness. Development only, authenticates nothing.")
    print(f"listening on   http://{args.host}:{args.port}")
    print(f"capture dir    {outdir}")
    print(f"response       {args.status}", end="")
    if args.fail_first:
        print(f"  (first {args.fail_first} request(s) get 500)", end="")
    print()
    print("Ctrl+C to stop.\n", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
