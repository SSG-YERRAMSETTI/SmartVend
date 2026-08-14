"""HTTP Basic authentication for Cantaloupe inbound deliveries.

Every credential here is fake. No network, no Seed Live, no database, no AWS.
"""

from __future__ import annotations

import base64

import pytest

from integrations.authentication import (
    AuthenticationBackendUnavailable,
    AuthenticationFailed,
    BasicAuthenticator,
    parse_basic_authorization,
)
from integrations.credentials import (
    BasicCredential,
    CredentialNotFound,
    CredentialProviderUnavailable,
)
from integrations.inbound import InboundReportRequest

from .conftest import (
    FAKE_PASSWORD,
    FAKE_USERNAME,
    FakeCredentialProvider,
    MalformedCredentialProvider,
    basic_header,
    make_connection,
)

PAYLOAD = b"TransactionId,Amount\r\n1,2.50\r\n"


def request_with(header: str | None) -> InboundReportRequest:
    headers = {"content-type": "text/csv"}
    if header is not None:
        headers["authorization"] = header
    return InboundReportRequest(payload=PAYLOAD, headers=headers)


def b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


class TestParseBasicAuthorization:
    def test_parses_username_and_password(self) -> None:
        u, p = parse_basic_authorization(basic_header("alice", "s3cret"))
        assert (u, p) == ("alice", "s3cret")

    def test_scheme_is_case_insensitive(self) -> None:
        """RFC 7235 makes the scheme token case-insensitive."""
        for scheme in ("Basic", "basic", "BASIC", "BaSiC"):
            u, _ = parse_basic_authorization(f"{scheme} {b64('alice:s3cret')}")
            assert u == "alice"

    def test_password_may_contain_a_colon(self) -> None:
        u, p = parse_basic_authorization(basic_header("alice", "a:b:c"))
        assert (u, p) == ("alice", "a:b:c")

    def test_tolerates_extra_whitespace(self) -> None:
        u, p = parse_basic_authorization(f"  Basic   {b64('alice:s3cret')}  ")
        assert (u, p) == ("alice", "s3cret")

    @pytest.mark.parametrize(
        "header",
        [
            "",
            "   ",
            "Basic",
            "Basic ",
            "Bearer " + b64("alice:s3cret"),
            "Digest " + b64("alice:s3cret"),
            "Basic !!!not-base64!!!",
            "Basic " + b64("no-colon-here"),
        ],
    )
    def test_rejects_malformed_or_unsupported(self, header: str) -> None:
        with pytest.raises(AuthenticationFailed):
            parse_basic_authorization(header)

    def test_rejects_undecodable_bytes(self) -> None:
        token = base64.b64encode(b"\xff\xfe:\xff").decode("ascii")
        with pytest.raises(AuthenticationFailed):
            parse_basic_authorization(f"Basic {token}")

    def test_error_never_contains_the_header(self) -> None:
        secret = b64("alice:very-secret-value")
        with pytest.raises(AuthenticationFailed) as caught:
            parse_basic_authorization(f"Bearer {secret}")
        message = str(caught.value)
        assert secret not in message
        assert "very-secret-value" not in message


class TestBasicAuthenticator:
    def setup_method(self) -> None:
        self.provider = FakeCredentialProvider()
        self.auth = BasicAuthenticator(self.provider)
        self.connection = make_connection()

    def verify(self, header: str | None, connection=None) -> None:
        self.auth.verify(request_with(header), connection or self.connection)

    def test_valid_credentials_accepted(self) -> None:
        self.verify(basic_header(FAKE_USERNAME, FAKE_PASSWORD))

    def test_credential_is_resolved_from_the_connection_reference(self) -> None:
        self.verify(basic_header(FAKE_USERNAME, FAKE_PASSWORD))
        assert self.provider.calls == [self.connection.credential_ref]

    def test_missing_authorization_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(None)

    def test_header_lookup_is_case_insensitive(self) -> None:
        request = InboundReportRequest(
            payload=PAYLOAD,
            headers={"AuThOrIzAtIoN": basic_header(FAKE_USERNAME, FAKE_PASSWORD)},
        )
        self.auth.verify(request, self.connection)

    def test_wrong_scheme_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(f"Bearer {b64(f'{FAKE_USERNAME}:{FAKE_PASSWORD}')}")

    def test_malformed_base64_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify("Basic ****not base64****")

    def test_decoded_without_colon_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(f"Basic {b64('usernameonly')}")

    def test_wrong_username_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header("wrong-user", FAKE_PASSWORD))

    def test_wrong_password_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header(FAKE_USERNAME, "wrong-password"))

    def test_empty_supplied_username_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header("", FAKE_PASSWORD))

    def test_empty_supplied_password_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header(FAKE_USERNAME, ""))

    def test_both_empty_rejected(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header("", ""))

    def test_connection_without_credential_reference_rejected(self) -> None:
        bare = make_connection(credential_ref=None)
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header(FAKE_USERNAME, FAKE_PASSWORD), bare)

    def test_unresolvable_credential_reference_rejected(self) -> None:
        unknown = make_connection(credential_ref="secretstore://test/absent")
        with pytest.raises(AuthenticationFailed):
            self.verify(basic_header(FAKE_USERNAME, FAKE_PASSWORD), unknown)

    def test_credential_provider_unavailable_is_a_backend_failure(self) -> None:
        auth = BasicAuthenticator(FakeCredentialProvider(unavailable=True))
        with pytest.raises(AuthenticationBackendUnavailable):
            auth.verify(
                request_with(basic_header(FAKE_USERNAME, FAKE_PASSWORD)),
                self.connection,
            )

    def test_malformed_stored_credential_rejected(self) -> None:
        auth = BasicAuthenticator(MalformedCredentialProvider())
        with pytest.raises(AuthenticationFailed):
            auth.verify(
                request_with(basic_header(FAKE_USERNAME, FAKE_PASSWORD)),
                self.connection,
            )

    def test_never_falls_back_to_unauthenticated(self) -> None:
        """Every failure path raises. None returns quietly."""
        cases = [
            (None, self.connection),
            ("Basic garbage", self.connection),
            (basic_header("x", "y"), self.connection),
            (basic_header(FAKE_USERNAME, FAKE_PASSWORD), make_connection(credential_ref=None)),
        ]
        for header, connection in cases:
            with pytest.raises(AuthenticationFailed):
                self.verify(header, connection)

    def test_failure_messages_never_contain_credentials(self) -> None:
        for header in (
            basic_header(FAKE_USERNAME, "wrong-password"),
            basic_header("wrong-user", FAKE_PASSWORD),
            f"Bearer {b64(f'{FAKE_USERNAME}:{FAKE_PASSWORD}')}",
        ):
            with pytest.raises(AuthenticationFailed) as caught:
                self.verify(header)
            message = str(caught.value)
            assert FAKE_PASSWORD not in message
            assert FAKE_USERNAME not in message
            assert header not in message

    def test_missing_credential_and_wrong_password_fail_identically(self) -> None:
        """Otherwise the response tells a caller whether a credential exists."""
        with pytest.raises(AuthenticationFailed) as no_cred:
            self.verify(
                basic_header(FAKE_USERNAME, FAKE_PASSWORD),
                make_connection(credential_ref=None),
            )
        with pytest.raises(AuthenticationFailed) as bad_pass:
            self.verify(basic_header(FAKE_USERNAME, "wrong-password"))
        assert type(no_cred.value) is type(bad_pass.value)


class TestFailureClassDistinction:
    """Caller failure and infrastructure failure must stay separable.

    Collapsing them would make an outage indistinguishable from an attack in
    logs, metrics, and any future retry policy.
    """

    def setup_method(self) -> None:
        self.connection = make_connection()
        self.good_header = basic_header(FAKE_USERNAME, FAKE_PASSWORD)

    def _verify(self, provider, header=None, connection=None):
        BasicAuthenticator(provider).verify(
            request_with(header or self.good_header), connection or self.connection
        )

    def test_backend_unavailable_is_not_a_subclass_of_auth_failed(self) -> None:
        """The type hierarchy itself must not allow accidental swallowing."""
        assert not issubclass(AuthenticationBackendUnavailable, AuthenticationFailed)
        assert not issubclass(AuthenticationFailed, AuthenticationBackendUnavailable)

    def test_backend_unavailable_is_not_caught_as_bad_credentials(self) -> None:
        """`except AuthenticationFailed` must let an outage through."""
        with pytest.raises(AuthenticationBackendUnavailable):
            try:
                self._verify(FakeCredentialProvider(unavailable=True))
            except AuthenticationFailed:  # pragma: no cover - must not run
                pytest.fail("infrastructure failure was swallowed as bad credentials")

    def test_wrong_password_is_a_caller_failure(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self._verify(
                FakeCredentialProvider(), basic_header(FAKE_USERNAME, "wrong")
            )

    def test_wrong_password_is_not_a_backend_failure(self) -> None:
        try:
            self._verify(
                FakeCredentialProvider(), basic_header(FAKE_USERNAME, "wrong")
            )
        except AuthenticationBackendUnavailable:  # pragma: no cover
            pytest.fail("bad credentials were misreported as an outage")
        except AuthenticationFailed:
            pass

    def test_missing_credential_configuration_is_a_caller_failure(self) -> None:
        """A misconfigured connection is not an infrastructure outage."""
        with pytest.raises(AuthenticationFailed):
            self._verify(
                FakeCredentialProvider(),
                connection=make_connection(credential_ref=None),
            )

    def test_unresolvable_reference_is_a_caller_failure(self) -> None:
        with pytest.raises(AuthenticationFailed):
            self._verify(
                FakeCredentialProvider(),
                connection=make_connection(credential_ref="secretstore://test/absent"),
            )

    def test_backend_failure_message_carries_no_credentials(self) -> None:
        with pytest.raises(AuthenticationBackendUnavailable) as caught:
            self._verify(FakeCredentialProvider(unavailable=True))
        message = str(caught.value)
        assert FAKE_PASSWORD not in message
        assert FAKE_USERNAME not in message
        assert self.good_header not in message


class TestBasicCredential:
    def test_password_is_hidden_from_repr(self) -> None:
        cred = BasicCredential("alice", "very-secret-value")
        assert "very-secret-value" not in repr(cred)
        assert "very-secret-value" not in str(cred)
        assert "redacted" in repr(cred)

    def test_empty_username_is_a_configuration_error(self) -> None:
        with pytest.raises(ValueError):
            BasicCredential("", "password")

    def test_empty_password_is_a_configuration_error(self) -> None:
        """RFC 7617 permits it; we refuse to authenticate on a blank secret."""
        with pytest.raises(ValueError):
            BasicCredential("alice", "")


class TestCredentialProviderContract:
    def test_unknown_reference_raises_not_found(self) -> None:
        with pytest.raises(CredentialNotFound):
            FakeCredentialProvider().resolve_basic("secretstore://test/absent")

    def test_unavailable_store_raises_unavailable(self) -> None:
        with pytest.raises(CredentialProviderUnavailable):
            FakeCredentialProvider(unavailable=True).resolve_basic("any")

    def test_not_found_message_carries_no_secret(self) -> None:
        with pytest.raises(CredentialNotFound) as caught:
            FakeCredentialProvider().resolve_basic("secretstore://test/absent")
        assert FAKE_PASSWORD not in str(caught.value)
