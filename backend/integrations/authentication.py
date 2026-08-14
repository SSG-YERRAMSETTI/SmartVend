"""Inbound authentication boundary for provider deliveries.

Seed Live uses **HTTP Basic**, verified from a Test Transport: populating the
transport's Username and Password fields produces a standard
`Authorization: Basic` header, and leaving them blank produces no header at
all. Cloudflare was independently confirmed not to strip the header, so the
observed absence was the provider's behavior rather than a tunnel artifact.

`BasicAuthenticator` implements HTTP Basic authentication compatible with the
verified Seed Live Test Transport behavior and RFC 7617 framing, with SmartVend
policy requiring UTF-8 credentials and a non-empty username and password.

That policy is deliberately stricter than the RFC, so this is not a claim of
standards equivalence. RFC 7617 leaves the credential charset undefined and
permits an empty password; both are refused here.

Scope limit, deliberately recorded here because it governs how far this may be
trusted: the evidence comes from a **Test Transport**, not from a real
generated report delivery. Whether a real delivery authenticates identically is
**NOT VERIFIED**. The route stays unregistered until that is established.

Everything here fails closed. There is no path that accepts a request when
verification cannot be completed.
"""

from __future__ import annotations

import base64
import binascii
import hmac
from typing import Protocol

from integrations.connections import IntegrationConnection
from integrations.credentials import (
    BasicCredential,
    CredentialNotFound,
    CredentialProvider,
    CredentialProviderUnavailable,
)
from integrations.inbound import InboundReportRequest


class AuthenticationNotConfigured(Exception):
    """No verified authenticator is configured for this provider.

    Not a client error. The endpoint cannot serve safely, and says so, rather
    than accepting traffic it cannot authenticate.
    """

    def __init__(self, provider: str) -> None:
        super().__init__(
            f"inbound authentication for {provider} is not configured. The "
            "provider contract has not been verified, so no authenticator can "
            "be implemented yet."
        )
        self.provider = provider


class AuthenticationFailed(Exception):
    """The **caller** did not authenticate against the connection.

    Covers a missing or malformed header, an unsupported scheme, a wrong
    username or password, and a connection with no usable credential
    configuration. In every case the request itself is at fault, or the
    connection is misconfigured, and retrying unchanged will not help.

    The message is deliberately free of detail about which check failed, so an
    error response cannot be used to probe the scheme.
    """

    def __init__(self, reason: str = "authentication failed") -> None:
        super().__init__(reason)


class AuthenticationBackendUnavailable(Exception):
    """**Our** authentication infrastructure could not complete the check.

    Covers an unreachable secret store, a timeout, or any backing service
    failure that prevents verification from being attempted at all.

    Deliberately **not** a subclass of `AuthenticationFailed`, and never
    converted into one. The caller may be perfectly legitimate; we simply
    cannot tell right now. Collapsing the two would destroy the signal that
    logging, metrics, alerting, and any future retry policy depend on, and
    would make an outage indistinguishable from an attack in the telemetry.

    The public HTTP response is a separate policy decision. See
    `cantaloupe/routes.py`.
    """

    def __init__(self, reason: str = "authentication backend unavailable") -> None:
        super().__init__(reason)


class InboundAuthenticator(Protocol):
    """Verifies that a delivery genuinely came from the provider.

    Implementations must be constant-time where they compare secrets, must not
    log the credential material they inspect, and must not fall back to
    accepting a request when verification is impossible.
    """

    def verify(
        self,
        request: InboundReportRequest,
        connection: IntegrationConnection,
    ) -> None:
        """Return None when authentic, otherwise raise.

        Raises `AuthenticationFailed` when the request is rejected, or
        `AuthenticationNotConfigured` when verification cannot be attempted.
        """
        ...


class UnverifiedProviderAuthenticator:
    """Deny-by-default placeholder for a provider whose contract is unknown.

    Retained for providers other than Cantaloupe, and as the safe default when
    no authenticator has been chosen. It never authenticates anything.
    """

    def __init__(self, provider: str) -> None:
        self.provider = provider

    def verify(
        self,
        request: InboundReportRequest,
        connection: IntegrationConnection,
    ) -> None:
        raise AuthenticationNotConfigured(self.provider)


AUTHORIZATION_HEADER = "authorization"
BASIC_SCHEME = "basic"


def _get_header(request: InboundReportRequest, name: str) -> str | None:
    """Case-insensitive header lookup.

    HTTP header names are case-insensitive, and we must not depend on whatever
    casing a particular server or proxy happened to preserve.
    """
    lowered = name.lower()
    for key, value in request.headers.items():
        if key.lower() == lowered:
            return value
    return None


def parse_basic_authorization(header_value: str) -> tuple[str, str]:
    """Parse an `Authorization: Basic` header into username and password.

    Accepts RFC 7617 framing, with SmartVend policy requiring UTF-8
    credentials. Returns the pair, or raises `AuthenticationFailed` with a
    message that never contains any part of the header.

    Stricter than the RFC by intent: the RFC leaves the charset undefined,
    while anything that is not valid UTF-8 is refused here rather than guessed
    at. The non-empty username and password rule is enforced upstream, in
    `BasicCredential` and in the authenticator.

    The password may itself contain a colon; only the first separates the two,
    per the RFC.
    """
    if not header_value or not header_value.strip():
        raise AuthenticationFailed("empty authorization header")

    parts = header_value.strip().split(None, 1)
    if len(parts) != 2:
        raise AuthenticationFailed("malformed authorization header")

    scheme, token = parts[0], parts[1].strip()
    if scheme.lower() != BASIC_SCHEME:
        # Case-insensitive per RFC 7235. Any other scheme is unsupported.
        raise AuthenticationFailed("unsupported authorization scheme")
    if not token:
        raise AuthenticationFailed("missing credentials")

    try:
        decoded_bytes = base64.b64decode(token, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AuthenticationFailed("malformed credential encoding") from exc

    try:
        decoded = decoded_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        # SmartVend policy: credentials must be UTF-8. RFC 7617 leaves the
        # charset undefined, so this is stricter than the standard by intent.
        # Anything else fails closed rather than being guessed at.
        raise AuthenticationFailed("undecodable credential") from exc

    if ":" not in decoded:
        raise AuthenticationFailed("malformed credential")

    username, _, password = decoded.partition(":")
    return username, password


def _constant_time_equal(supplied: str, expected: str) -> bool:
    """Compare two strings without leaking their contents through timing.

    Both operands are compared, not short-circuited on length, because the
    username is also worth protecting: a timing oracle on it would let a caller
    enumerate configured usernames.
    """
    return hmac.compare_digest(
        supplied.encode("utf-8"), expected.encode("utf-8")
    )


class BasicAuthenticator:
    """HTTP Basic authentication against a connection's configured credential.

    Fails closed on every path: a missing header, an unsupported scheme, a
    malformed credential, an unconfigured connection, an unreachable secret
    store, and a wrong username or password all raise `AuthenticationFailed`.

    Crucially, **a connection with no credential configured fails exactly like
    a wrong password**. Distinguishing them would tell an unauthenticated
    caller whether a credential reference exists, which is the enumeration
    protection the route depends on.
    """

    def __init__(self, credentials: CredentialProvider) -> None:
        self.credentials = credentials

    def verify(
        self,
        request: InboundReportRequest,
        connection: IntegrationConnection,
    ) -> None:
        header = _get_header(request, AUTHORIZATION_HEADER)
        if header is None:
            raise AuthenticationFailed("missing authorization header")

        supplied_username, supplied_password = parse_basic_authorization(header)

        if not connection.credential_ref:
            raise AuthenticationFailed("connection has no credential configured")

        try:
            expected: BasicCredential = self.credentials.resolve_basic(
                connection.credential_ref
            )
        except CredentialNotFound as exc:
            # Configuration fault on this connection, not an infrastructure
            # fault. Retrying will not help until the configuration changes.
            raise AuthenticationFailed("credential not resolvable") from exc
        except CredentialProviderUnavailable as exc:
            # Our infrastructure, not the caller. Preserved as its own class so
            # it stays visible in logs, metrics, and retry policy. What the
            # provider is told is decided at the route, not here.
            raise AuthenticationBackendUnavailable(
                "credential provider unavailable"
            ) from exc
        except ValueError as exc:
            # A provider returning a malformed credential is a configuration
            # fault, not an authenticated caller.
            raise AuthenticationFailed("credential malformed") from exc

        username_ok = _constant_time_equal(supplied_username, expected.username)
        password_ok = _constant_time_equal(supplied_password, expected.password)

        # Both comparisons always run, so the response time does not reveal
        # whether the username alone was correct.
        if not (username_ok and password_ok):
            raise AuthenticationFailed("credential mismatch")
