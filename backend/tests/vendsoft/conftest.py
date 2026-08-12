import pytest

from vendsoft.client import VendSoftReadClient
from vendsoft.config import VendSoftConfig

from helpers import FAKE_KEY, FakeSession


@pytest.fixture
def config():
    return VendSoftConfig(
        base_url="https://example.invalid/api/v2",
        api_key=FAKE_KEY,
        min_interval_s=0.0,
        timeout_s=5.0,
        max_retries=3,
        backoff_base_s=0.0,
    )


@pytest.fixture
def make_client(config):
    def _make(responses):
        c = VendSoftReadClient(config)
        c._http = FakeSession(responses)
        return c

    return _make
