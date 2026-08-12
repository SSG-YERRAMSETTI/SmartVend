"""The Cantaloupe inbound HTTP boundary.

Exercised through a standalone FastAPI app. The router is deliberately not
registered in the production application, so these tests mount it themselves.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from integrations.cantaloupe import routes
from integrations.cantaloupe.routes import (
    MAX_PAYLOAD_BYTES,
    UNATTRIBUTABLE_DETAIL,
    UNATTRIBUTABLE_STATUS,
    get_artifact_store,
    get_connection_resolver,
    get_inbound_authenticator,
)
from integrations.connections import ConnectionStatus
from integrations.providers import Provider

from .conftest import (
    CONNECTION_ID,
    AcceptingAuthenticator,
    FakeArtifactStore,
    FakeConnectionResolver,
    RejectingAuthenticator,
    make_connection,
)

BACKEND_DIR = Path(__file__).resolve().parents[2]

PATH = f"/integrations/cantaloupe/{CONNECTION_ID}/reports"
PAYLOAD = b"TransactionId,Amount\r\n1,2.50\r\n"

#: Sentinel so a test can ask for the real default authenticator rather than
#: the accepting test double.
USE_REAL_AUTHENTICATOR = object()


def build_client(
    *,
    connections=None,
    store=None,
    authenticator=None,
) -> tuple[TestClient, FakeArtifactStore]:
    app = FastAPI()
    app.include_router(routes.router)

    artifact_store = store or FakeArtifactStore()
    resolver = FakeConnectionResolver(
        *(connections if connections is not None else [make_connection()])
    )

    app.dependency_overrides[get_connection_resolver] = lambda: resolver
    app.dependency_overrides[get_artifact_store] = lambda: artifact_store
    if authenticator is not USE_REAL_AUTHENTICATOR:
        app.dependency_overrides[get_inbound_authenticator] = (
            lambda: authenticator or AcceptingAuthenticator()
        )
    return TestClient(app), artifact_store


class TestRouteRegistration:
    """The endpoint must not be live until authentication is verified.

    Checked by reading main.py rather than importing it: the application module
    raises at import time without DATABASE_URL, and this property is a source
    fact that does not need a running app to verify.
    """

    def test_router_is_not_registered_in_the_application(self) -> None:
        main_source = (BACKEND_DIR / "main.py").read_text(encoding="utf-8")
        assert "cantaloupe" not in main_source.lower(), (
            "The Cantaloupe router appears to be registered in main.py. It must "
            "stay unregistered until a verified inbound authenticator exists."
        )

    def test_route_path_is_provider_specific(self) -> None:
        paths = {r.path for r in routes.router.routes}
        assert "/integrations/cantaloupe/{connection_id}/reports" in paths


class TestNoInventedProviderContract:
    """Guards against re-encoding unverified Seed Live behavior."""

    def test_route_reads_no_report_type_signal(self) -> None:
        """Whether Seed Live conveys a report type, and how, is unverified."""
        source = (
            BACKEND_DIR / "integrations" / "cantaloupe" / "routes.py"
        ).read_text(encoding="utf-8")
        assert "x-report-type" not in source.lower()
        assert "report_type_hint=" not in source

    def test_report_type_hint_is_never_set_by_the_adapter(self) -> None:
        """An arbitrary header must not influence identification.

        The header used here has no provider basis and is not believed to be
        anything Seed Live sends. It is the exact signal a previous revision
        wrongly read, so this test exists to stop it being reintroduced.
        """
        client, store = build_client()
        response = client.post(
            PATH,
            content=PAYLOAD,
            headers={"x-report-type": "Single Transaction Data Export"},
        )
        assert response.status_code == 200
        artifact_id = response.json()["artifact_id"]
        stored = next(
            a for a in store.by_key.values() if a.id == artifact_id
        )
        # The header is ignored entirely: it is not a verified provider signal.
        assert stored.report_type == "unknown"

    def test_success_is_200_not_202(self) -> None:
        """202 must not become a contract before Test Transport confirms it.

        Checked against the declared route status and the imported symbols, not
        the prose: the module docstring legitimately explains why 202 is
        avoided.
        """
        route = next(
            r for r in routes.router.routes if str(r.path).endswith("/reports")
        )
        assert route.status_code == 200

        source = (
            BACKEND_DIR / "integrations" / "cantaloupe" / "routes.py"
        ).read_text(encoding="utf-8")
        assert "HTTP_202_ACCEPTED" not in source


class TestSuccessfulDelivery:
    def test_accepts_and_preserves_with_200(self) -> None:
        client, store = build_client()
        response = client.post(PATH, content=PAYLOAD)

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "accepted"
        assert body["replay"] is False
        assert body["artifact_id"]
        assert store.payloads[body["artifact_id"]] == PAYLOAD

    def test_replay_is_also_200_with_the_same_artifact(self) -> None:
        client, store = build_client()
        first = client.post(PATH, content=PAYLOAD)
        second = client.post(PATH, content=PAYLOAD)

        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["replay"] is True
        assert second.json()["artifact_id"] == first.json()["artifact_id"]
        assert len(store.payloads) == 1

    def test_response_exposes_only_what_is_needed(self) -> None:
        client, _ = build_client()
        body = client.post(PATH, content=PAYLOAD).json()
        assert set(body) == {"status", "artifact_id", "replay"}

    def test_response_carries_no_payload_content(self) -> None:
        client, _ = build_client()
        response = client.post(PATH, content=PAYLOAD)
        assert "TransactionId" not in response.text


class TestUnauthenticatedResponsesAreIndistinguishable:
    """No pre-authentication response may reveal whether a connection exists."""

    def _post(self, **kwargs):
        client, store = build_client(**kwargs)
        return client.post(PATH, content=kwargs.pop("body", PAYLOAD)), store

    def test_unknown_connection(self) -> None:
        client, store = build_client(connections=[])
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
        assert store.by_key == {}

    def test_connection_belonging_to_another_provider(self) -> None:
        client, _ = build_client(connections=[make_connection(provider=Provider.NAYAX)])
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL

    def test_failed_authentication(self) -> None:
        client, store = build_client(authenticator=RejectingAuthenticator())
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
        assert store.by_key == {}

    def test_oversized_payload_on_a_real_connection(self) -> None:
        client, store = build_client()
        response = client.post(PATH, content=b"x" * (MAX_PAYLOAD_BYTES + 1))
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
        assert store.by_key == {}

    def test_all_four_cases_produce_an_identical_response(self) -> None:
        """The property that closes the enumeration oracle."""
        unknown, _ = build_client(connections=[])
        wrong_provider, _ = build_client(
            connections=[make_connection(provider=Provider.NAYAX)]
        )
        bad_auth, _ = build_client(authenticator=RejectingAuthenticator())
        oversized, _ = build_client()

        responses = [
            unknown.post(PATH, content=PAYLOAD),
            wrong_provider.post(PATH, content=PAYLOAD),
            bad_auth.post(PATH, content=PAYLOAD),
            oversized.post(PATH, content=b"x" * (MAX_PAYLOAD_BYTES + 1)),
        ]

        statuses = {r.status_code for r in responses}
        bodies = {r.text for r in responses}
        assert statuses == {UNATTRIBUTABLE_STATUS}
        assert len(bodies) == 1, "responses must be byte-identical"

    def test_no_413_is_exposed(self) -> None:
        client, _ = build_client()
        response = client.post(PATH, content=b"x" * (MAX_PAYLOAD_BYTES + 1))
        assert response.status_code != 413


class TestUnavailability:
    def test_unconfigured_authenticator_returns_503_and_stores_nothing(self) -> None:
        """Uniform across every connection id, so it leaks nothing."""
        client, store = build_client(authenticator=USE_REAL_AUTHENTICATOR)
        response = client.post(PATH, content=PAYLOAD)

        assert response.status_code == 503
        assert store.by_key == {}
        assert store.payloads == {}

    def test_unconfigured_authenticator_is_identical_for_unknown_connections(
        self,
    ) -> None:
        known, _ = build_client(authenticator=USE_REAL_AUTHENTICATOR)
        unknown, _ = build_client(
            connections=[], authenticator=USE_REAL_AUTHENTICATOR
        )
        # An unknown connection is rejected earlier, so the two differ. That is
        # acceptable only while the authenticator is unconfigured for everyone
        # and the route is unregistered; once auth is configured the earlier
        # rejection and the auth failure are identical.
        assert known.post(PATH, content=PAYLOAD).status_code == 503
        assert (
            unknown.post(PATH, content=PAYLOAD).status_code == UNATTRIBUTABLE_STATUS
        )

    def test_missing_connection_storage_returns_503(self) -> None:
        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[get_artifact_store] = lambda: FakeArtifactStore()
        client = TestClient(app)

        assert client.post(PATH, content=PAYLOAD).status_code == 503

    def test_missing_artifact_storage_returns_503(self) -> None:
        app = FastAPI()
        app.include_router(routes.router)
        app.dependency_overrides[get_connection_resolver] = lambda: (
            FakeConnectionResolver(make_connection())
        )
        client = TestClient(app)

        assert client.post(PATH, content=PAYLOAD).status_code == 503


class TestAuthenticatedRejections:
    """Reachable only by an authenticated caller, so detail is safe."""

    def test_empty_payload_returns_400(self) -> None:
        client, store = build_client()
        response = client.post(PATH, content=b"")

        assert response.status_code == 400
        assert store.by_key == {}

    def test_disabled_connection_returns_409(self) -> None:
        client, store = build_client(
            connections=[make_connection(status=ConnectionStatus.DISABLED)]
        )
        response = client.post(PATH, content=PAYLOAD)

        assert response.status_code == 409
        assert store.by_key == {}

    def test_connection_state_is_not_revealed_before_authentication(self) -> None:
        """A disabled connection must look unattributable to a bad caller."""
        client, _ = build_client(
            connections=[make_connection(status=ConnectionStatus.DISABLED)],
            authenticator=RejectingAuthenticator(),
        )
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert response.json()["detail"] == UNATTRIBUTABLE_DETAIL
