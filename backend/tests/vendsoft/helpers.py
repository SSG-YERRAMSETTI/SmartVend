"""Shared fakes for the VendSoft mocked tests."""

import json

FAKE_KEY = "test-key-abc123-DO-NOT-USE"


class FakeResponse:
    def __init__(self, status=200, payload=None, headers=None, text=None):
        self.status_code = status
        self._payload = payload
        self.headers = headers or {"Content-Type": "application/json"}
        if text is not None:
            self.text = text
            self.content = text.encode()
        else:
            self.text = json.dumps(payload) if payload is not None else ""
            self.content = self.text.encode()

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    """Records outgoing GETs and returns scripted responses."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if not self.responses:
            return FakeResponse(200, [])
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt

    def close(self):
        pass
