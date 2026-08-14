"""The Cantaloupe inbound HTTP boundary.

Exercised through a standalone FastAPI app. The router is deliberately not
registered in the production application, so these tests mount it themselves.
"""

from __future__ import annotations

import ast
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from integrations.artifacts import RawReportArtifact
from integrations.cantaloupe import routes
from integrations.cantaloupe.routes import (
    BACKEND_UNAVAILABLE_DETAIL_PROVISIONAL,
    BACKEND_UNAVAILABLE_STATUS_PROVISIONAL,
    MAX_PAYLOAD_BYTES,
    UNATTRIBUTABLE_DETAIL,
    UNATTRIBUTABLE_STATUS,
    get_artifact_store,
    get_connection_resolver,
    get_credential_provider,
    get_inbound_authenticator,
)
from integrations.connections import ConnectionStatus
from integrations.providers import Provider

from .conftest import (
    CONNECTION_ID,
    ORG_ID,
    FAKE_PASSWORD,
    FAKE_USERNAME,
    VALID_BASIC_HEADER,
    AcceptingAuthenticator,
    FakeArtifactStore,
    FakeConnectionResolver,
    FakeCredentialProvider,
    RejectingAuthenticator,
    basic_header,
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


class TestOwnershipFieldNaming:
    """ADR-0002 D1a: `org_id` is the concrete ownership identifier.

    "tenant" remains correct as architectural prose, so these tests inspect
    real identifiers via the AST rather than grepping text. A comment
    explaining the rename must not fail the guard, and a resurrected
    `tenant_id` attribute must not pass it.
    """

    def _production_identifiers(self) -> set[str]:
        names: set[str] = set()
        for path in sorted((BACKEND_DIR / "integrations").rglob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.arg):
                    names.add(node.arg)
                elif isinstance(node, ast.Attribute):
                    names.add(node.attr)
                elif isinstance(node, ast.Name):
                    names.add(node.id)
                elif isinstance(node, ast.keyword) and node.arg:
                    names.add(node.arg)
                elif isinstance(node, ast.AnnAssign) and isinstance(
                    node.target, ast.Name
                ):
                    names.add(node.target.id)
        return names

    def test_no_concrete_tenant_id_identifier_remains(self) -> None:
        assert "tenant_id" not in self._production_identifiers()

    def test_org_id_is_the_identifier_in_use(self) -> None:
        assert "org_id" in self._production_identifiers()

    def test_no_compatibility_alias_creates_a_second_identifier(self) -> None:
        """One ownership identifier, not two. ADR-0002 D1a is explicit."""
        connection = make_connection()
        artifact = RawReportArtifact(
            id="a",
            org_id=ORG_ID,
            connection_id=CONNECTION_ID,
            provider=Provider.CANTALOUPE,
            report_type="unknown",
            received_at=datetime.now(timezone.utc),
            payload_hash="h",
            size_bytes=1,
            idempotency_key="k",
        )
        for obj in (connection, artifact):
            assert hasattr(obj, "org_id")
            assert not hasattr(obj, "tenant_id")

    def test_successful_response_carries_no_org_identity(self) -> None:
        client, _ = build_client()
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == 200
        assert ORG_ID not in response.text
        assert "org_id" not in response.text

    def test_pre_authentication_response_carries_no_org_identity(self) -> None:
        """An unauthenticated caller learns nothing about ownership."""
        client, _ = build_client(authenticator=RejectingAuthenticator())
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == 404
        assert ORG_ID not in response.text
        assert "org" not in response.text.lower()

    def test_artifact_ownership_is_scoped_to_the_connection_org(self) -> None:
        client, store = build_client()
        artifact_id = client.post(PATH, content=PAYLOAD).json()["artifact_id"]
        stored = next(a for a in store.by_key.values() if a.id == artifact_id)
        assert stored.org_id == ORG_ID


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

    def test_unconfigured_credentials_are_identical_for_unknown_connections(
        self,
    ) -> None:
        """An unconfigured credential provider leaks nothing about connections.

        The provider is a dependency, so it fails before the route body runs.
        Known and unknown connection identifiers therefore produce byte-identical
        responses, closing the oracle that existed while the authenticator was a
        deny-by-default placeholder resolved inside the handler.
        """
        known, _ = build_client(authenticator=USE_REAL_AUTHENTICATOR)
        unknown, _ = build_client(
            connections=[], authenticator=USE_REAL_AUTHENTICATOR
        )

        a = known.post(PATH, content=PAYLOAD)
        b = unknown.post(PATH, content=PAYLOAD)

        assert a.status_code == 503
        assert b.status_code == 503
        assert a.text == b.text

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


class TestBasicAuthenticationThroughTheRoute:
    """End-to-end HTTP Basic, using the real authenticator and fake secrets."""

    def build(self, *, connections=None, provider=None):
        app = FastAPI()
        app.include_router(routes.router)
        store = FakeArtifactStore()
        resolver = FakeConnectionResolver(
            *(connections if connections is not None else [make_connection()])
        )
        app.dependency_overrides[get_connection_resolver] = lambda: resolver
        app.dependency_overrides[get_artifact_store] = lambda: store
        app.dependency_overrides[get_credential_provider] = (
            lambda: provider or FakeCredentialProvider()
        )
        return TestClient(app), store

    def test_valid_credentials_accepted(self) -> None:
        client, store = self.build()
        response = client.post(
            PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "accepted"
        assert len(store.payloads) == 1

    def test_missing_authorization_rejected_and_nothing_stored(self) -> None:
        client, store = self.build()
        response = client.post(PATH, content=PAYLOAD)
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert store.by_key == {}
        assert store.payloads == {}

    def test_wrong_password_rejected_and_nothing_stored(self) -> None:
        client, store = self.build()
        response = client.post(
            PATH,
            content=PAYLOAD,
            headers={"Authorization": basic_header(FAKE_USERNAME, "wrong")},
        )
        assert response.status_code == UNATTRIBUTABLE_STATUS
        assert store.by_key == {}

    def test_connection_without_credential_looks_like_a_bad_password(self) -> None:
        """The credential-existence oracle stays closed at the HTTP boundary."""
        no_cred, _ = self.build(connections=[make_connection(credential_ref=None)])
        bad_pass, _ = self.build()

        a = no_cred.post(
            PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
        )
        b = bad_pass.post(
            PATH,
            content=PAYLOAD,
            headers={"Authorization": basic_header(FAKE_USERNAME, "wrong")},
        )
        assert a.status_code == b.status_code == UNATTRIBUTABLE_STATUS
        assert a.text == b.text

    def test_all_failure_modes_are_indistinguishable(self) -> None:
        unknown, _ = self.build(connections=[])
        bad_scheme, _ = self.build()
        bad_b64, _ = self.build()
        wrong_user, _ = self.build()
        no_cred, _ = self.build(connections=[make_connection(credential_ref=None)])
        store_down, _ = self.build(provider=FakeCredentialProvider(unavailable=True))

        responses = [
            unknown.post(PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}),
            bad_scheme.post(PATH, content=PAYLOAD, headers={"Authorization": "Bearer abc"}),
            bad_b64.post(PATH, content=PAYLOAD, headers={"Authorization": "Basic !!!"}),
            wrong_user.post(
                PATH, content=PAYLOAD,
                headers={"Authorization": basic_header("nobody", FAKE_PASSWORD)},
            ),
            no_cred.post(PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}),
            store_down.post(PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}),
        ]
        assert {r.status_code for r in responses} == {UNATTRIBUTABLE_STATUS}
        assert len({r.text for r in responses}) == 1, "responses must be identical"

    def test_credentials_never_appear_in_a_response(self) -> None:
        client, _ = self.build()
        for headers in (
            {"Authorization": VALID_BASIC_HEADER},
            {"Authorization": basic_header(FAKE_USERNAME, "wrong")},
        ):
            r = client.post(PATH, content=PAYLOAD, headers=headers)
            assert FAKE_PASSWORD not in r.text
            assert FAKE_USERNAME not in r.text
            assert headers["Authorization"] not in r.text

    def test_credentials_never_appear_in_logs(self, caplog) -> None:
        client, _ = self.build()
        with caplog.at_level(logging.DEBUG):
            client.post(
                PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
            )
            client.post(
                PATH,
                content=PAYLOAD,
                headers={"Authorization": basic_header(FAKE_USERNAME, "wrong")},
            )
        logged = caplog.text
        assert FAKE_PASSWORD not in logged
        assert VALID_BASIC_HEADER not in logged
        assert "Basic " not in logged

    def test_credentials_never_reach_the_stored_artifact(self) -> None:
        client, store = self.build()
        client.post(
            PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
        )
        artifact = next(iter(store.by_key.values()))
        rendered = repr(artifact) + repr(artifact.transport_metadata)
        assert FAKE_PASSWORD not in rendered
        assert "authorization" not in {k.lower() for k in artifact.transport_metadata}

    def test_backend_outage_persists_nothing(self) -> None:
        client, store = self.build(provider=FakeCredentialProvider(unavailable=True))
        client.post(
            PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
        )
        assert store.by_key == {}
        assert store.payloads == {}

    def test_backend_outage_uses_the_provisional_mapping(self) -> None:
        """PROVISIONAL. Not the final response; see the constant in routes.py."""
        client, _ = self.build(provider=FakeCredentialProvider(unavailable=True))
        response = client.post(
            PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
        )
        assert response.status_code == BACKEND_UNAVAILABLE_STATUS_PROVISIONAL
        assert response.json()["detail"] == BACKEND_UNAVAILABLE_DETAIL_PROVISIONAL

    def test_backend_outage_is_publicly_indistinguishable_but_logged_apart(
        self, caplog
    ) -> None:
        """Uniform to the caller, distinct in telemetry."""
        outage, _ = self.build(provider=FakeCredentialProvider(unavailable=True))
        bad_pass, _ = self.build()

        with caplog.at_level(logging.DEBUG):
            a = outage.post(
                PATH, content=PAYLOAD, headers={"Authorization": VALID_BASIC_HEADER}
            )
            b = bad_pass.post(
                PATH,
                content=PAYLOAD,
                headers={"Authorization": basic_header(FAKE_USERNAME, "wrong")},
            )

        assert a.status_code == b.status_code
        assert a.text == b.text, "public responses must be identical"

        logged = caplog.text
        assert "authentication backend unavailable" in logged
        assert "authentication_failed" in logged
        assert FAKE_PASSWORD not in logged
        assert VALID_BASIC_HEADER not in logged

    def test_successful_auth_preserves_the_deterministic_ingest_flow(self) -> None:
        client, store = self.build()
        headers = {"Authorization": VALID_BASIC_HEADER}
        first = client.post(PATH, content=PAYLOAD, headers=headers)
        second = client.post(PATH, content=PAYLOAD, headers=headers)

        assert first.status_code == second.status_code == 200
        assert first.json()["replay"] is False
        assert second.json()["replay"] is True
        assert second.json()["artifact_id"] == first.json()["artifact_id"]
        assert len(store.payloads) == 1


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
