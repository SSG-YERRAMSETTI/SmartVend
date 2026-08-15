"""The Seed Live inbound route, exercised through the real application.

Everything here runs against the `app` object built in `backend/main.py`, not a
standalone test app. That is the point: it proves the route is actually
registered and reachable in SmartVend, not merely that a router module exists.

`main.py` raises at import time without DATABASE_URL and JWT_SECRET, so those
are set to throwaway values before import. `create_engine` does not connect, and
nothing in this file issues a query, so no database is touched.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://unused:unused@127.0.0.1:1/unused")
os.environ.setdefault("JWT_SECRET", "test-only-not-a-real-secret")

import main  # noqa: E402
from integrations.cantaloupe.routes import (  # noqa: E402
    UNATTRIBUTABLE_DETAIL,
    UNATTRIBUTABLE_STATUS,
    get_artifact_store,
    get_connection_resolver,
    get_credential_provider,
)
from integrations.connections import ConnectionStatus  # noqa: E402

from .conftest import (  # noqa: E402
    CONNECTION_ID,
    FAKE_PASSWORD,
    FAKE_USERNAME,
    ORG_ID,
    OTHER_ORG_ID,
    VALID_BASIC_HEADER,
    FakeArtifactStore,
    FakeConnectionResolver,
    FakeCredentialProvider,
    basic_header,
    make_connection,
)

PATH = f"/integrations/cantaloupe/{CONNECTION_ID}/reports"
PAYLOAD = b"TransactionId,Amount\r\n1,2.50\r\n"
OTHER_CONNECTION_ID = "44444444-4444-4444-4444-444444444444"


@pytest.fixture
def wired():
    """Override only the unimplemented persistence dependencies on the real app.

    Authentication is NOT overridden: the real `BasicAuthenticator` runs, so
    these tests exercise the actual credential path.
    """
    store = FakeArtifactStore()
    connections = [make_connection()]
    credentials = FakeCredentialProvider()

    def apply(*, conns=None, cred_provider=None):
        resolver = FakeConnectionResolver(*(conns if conns is not None else connections))
        main.app.dependency_overrides[get_connection_resolver] = lambda: resolver
        main.app.dependency_overrides[get_artifact_store] = lambda: store
        main.app.dependency_overrides[get_credential_provider] = (
            lambda: cred_provider or credentials
        )
        return TestClient(main.app), store

    yield apply
    main.app.dependency_overrides.clear()


def post(client, *, body=PAYLOAD, auth=VALID_BASIC_HEADER, path=PATH):
    headers = {"Authorization": auth} if auth else {}
    return client.post(path, content=body, headers=headers)


class TestRouteIsRegistered:
    def test_route_is_reachable_on_the_real_application(self) -> None:
        """The Task 5 headline: the endpoint exists inside SmartVend."""
        paths = {getattr(r, "path", None) for r in main.app.routes}
        assert "/integrations/cantaloupe/{connection_id}/reports" in paths

    def test_route_is_registered_in_main(self) -> None:
        source = (
            __import__("pathlib").Path(main.__file__).read_text(encoding="utf-8")
        )
        assert "cantaloupe_router" in source

    def test_unconfigured_application_fails_closed(self) -> None:
        """With no overrides, nothing is accepted. No in-memory default exists.

        An unconfigured deployment must refuse deliveries rather than
        acknowledge and silently drop them.
        """
        client = TestClient(main.app)
        response = client.post(PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER})
        assert response.status_code == 503


class TestSuccessfulDelivery:
    def test_valid_delivery_is_accepted(self, wired) -> None:
        client, store = wired()
        response = post(client)

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "accepted"
        assert body["replay"] is False
        assert body["artifact_id"]

    def test_exact_bytes_reach_artifact_preservation(self, wired) -> None:
        client, store = wired()
        artifact_id = post(client).json()["artifact_id"]
        assert store.payloads[artifact_id] == PAYLOAD

    def test_binary_non_utf8_body_is_accepted_as_bytes(self, wired) -> None:
        """Provider framing is unverified, so the path must be byte-transparent."""
        client, store = wired()
        binary = bytes(range(256)) + b"\xff\xfe\r\n"

        response = post(client, body=binary)
        assert response.status_code == 200
        assert store.payloads[response.json()["artifact_id"]] == binary

    def test_org_id_comes_from_the_resolved_connection(self, wired) -> None:
        client, store = wired()
        artifact_id = post(client).json()["artifact_id"]
        stored = next(a for a in store.by_key.values() if a.id == artifact_id)

        assert stored.org_id == ORG_ID
        assert stored.connection_id == CONNECTION_ID

    def test_response_exposes_no_ownership_information(self, wired) -> None:
        client, _ = wired()
        response = post(client)
        assert set(response.json()) == {"status", "artifact_id", "replay"}
        assert ORG_ID not in response.text


class TestAuthentication:
    def test_missing_authorization_is_rejected(self, wired) -> None:
        client, store = wired()
        response = post(client, auth=None)

        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL

    def test_bad_password_is_rejected(self, wired) -> None:
        client, _ = wired()
        response = post(client, auth=basic_header(FAKE_USERNAME, "wrong-password"))
        assert response.status_code == UNATTRIBUTABLE_STATUS

    def test_bad_username_is_rejected(self, wired) -> None:
        client, _ = wired()
        response = post(client, auth=basic_header("wrong-user", FAKE_PASSWORD))
        assert response.status_code == UNATTRIBUTABLE_STATUS

    def test_authentication_failure_preserves_nothing(self, wired) -> None:
        """An unauthenticated caller cannot fill the artifact store."""
        client, store = wired()
        post(client, auth=None)
        post(client, auth=basic_header(FAKE_USERNAME, "wrong-password"))

        assert store.by_key == {}
        assert store.payloads == {}

    def test_credential_backend_failure_leaks_no_detail(self, wired) -> None:
        """An outage must not be distinguishable to an anonymous caller."""
        client, store = wired(cred_provider=FakeCredentialProvider(unavailable=True))
        response = post(client)

        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
        assert "unavailable" not in response.text.lower()
        assert store.by_key == {}


class TestTenantIsolation:
    def test_hostile_body_cannot_change_ownership(self, wired) -> None:
        client, store = wired()
        hostile = (
            b'{"org_id":"' + OTHER_ORG_ID.encode() + b'",'
            b'"organization_id":"' + OTHER_ORG_ID.encode() + b'"}'
        )

        artifact_id = post(client, body=hostile).json()["artifact_id"]
        stored = next(a for a in store.by_key.values() if a.id == artifact_id)

        assert stored.org_id == ORG_ID
        assert stored.org_id != OTHER_ORG_ID

    def test_another_orgs_connection_id_is_not_usable(self, wired) -> None:
        """A connection the resolver does not serve is unattributable."""
        client, store = wired()
        other_path = f"/integrations/cantaloupe/{OTHER_CONNECTION_ID}/reports"

        response = post(client, path=other_path)

        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
        assert store.by_key == {}

    def test_identical_bytes_for_another_org_are_a_separate_artifact(self, wired) -> None:
        other = make_connection(
            connection_id=OTHER_CONNECTION_ID, org_id=OTHER_ORG_ID
        )
        client, store = wired(conns=[make_connection(), other])

        first = post(client)
        second = post(
            client, path=f"/integrations/cantaloupe/{OTHER_CONNECTION_ID}/reports"
        )

        assert first.json()["artifact_id"] != second.json()["artifact_id"]
        assert second.json()["replay"] is False
        assert len(store.payloads) == 2


class TestReplay:
    def test_same_delivery_twice_stores_one_artifact(self, wired) -> None:
        client, store = wired()

        first = post(client)
        second = post(client)

        assert second.status_code == 200
        assert second.json()["replay"] is True
        assert second.json()["artifact_id"] == first.json()["artifact_id"]
        assert len(store.payloads) == 1

    def test_replay_detection_is_deterministic(self, wired) -> None:
        client, store = wired()
        results = [post(client).json() for _ in range(4)]

        assert results[0]["replay"] is False
        assert all(r["replay"] is True for r in results[1:])
        assert len({r["artifact_id"] for r in results}) == 1
        assert len(store.payloads) == 1

    def test_different_bytes_are_a_new_artifact(self, wired) -> None:
        client, store = wired()
        first = post(client)
        second = post(client, body=b"different\r\n")

        assert second.json()["replay"] is False
        assert second.json()["artifact_id"] != first.json()["artifact_id"]
        assert len(store.payloads) == 2


class TestConnectionState:
    @pytest.mark.parametrize(
        "status", [ConnectionStatus.ACTIVE, ConnectionStatus.DEGRADED]
    )
    def test_states_that_accept_inbound(self, wired, status) -> None:
        """DEGRADED describes delivery health, not authorization."""
        client, store = wired(conns=[make_connection(status=status)])
        response = post(client)

        assert response.status_code == 200
        assert len(store.payloads) == 1

    @pytest.mark.parametrize(
        "status",
        [
            ConnectionStatus.PENDING,
            ConnectionStatus.FAILED,
            ConnectionStatus.DISABLED,
        ],
    )
    def test_states_that_reject_inbound(self, wired, status) -> None:
        client, store = wired(conns=[make_connection(status=status)])
        response = post(client)

        assert response.status_code == 409
        assert store.by_key == {}

    def test_connection_state_is_only_revealed_after_authentication(
        self, wired
    ) -> None:
        """409 leaks that the connection exists, so it must require auth first."""
        client, _ = wired(conns=[make_connection(status=ConnectionStatus.DISABLED)])
        response = post(client, auth=None)

        assert response.status_code == UNATTRIBUTABLE_STATUS


class TestPayloadSize:
    def test_empty_body_is_rejected(self, wired) -> None:
        client, store = wired()
        response = post(client, body=b"")

        assert response.status_code == 400
        assert store.by_key == {}

    def test_oversized_body_is_indistinguishable_from_an_unknown_connection(
        self, wired
    ) -> None:
        """Not 413: a size limit must not become a connection-id oracle."""
        from integrations.cantaloupe.routes import MAX_PAYLOAD_BYTES

        client, store = wired()
        response = post(client, body=b"x" * (MAX_PAYLOAD_BYTES + 1))

        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
        assert store.by_key == {}
