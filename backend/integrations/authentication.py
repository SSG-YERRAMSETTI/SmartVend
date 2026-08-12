"""Inbound authentication boundary for provider deliveries.

The Seed Live authentication contract has **not** been verified. No header
name, signature scheme, or shared-secret mechanism is known. Inventing one and
implementing it would produce an endpoint that looks authenticated and is not.

So this module defines the boundary and nothing else. The default
implementation denies every request, and the route refuses to serve until a
verified authenticator is configured. A safe incomplete boundary is preferable
to a fake working integration.
"""

from __future__ import annotations

from typing import Protocol

from integrations.connections import IntegrationConnection
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
    """The request did not authenticate against the connection.

    The message is deliberately free of detail about which check failed, so an
    error response cannot be used to probe the scheme.
    """

    def __init__(self, reason: str = "authentication failed") -> None:
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
    """Deny-by-default placeholder used until the contract is verified.

    This exists so the route can be wired end to end and tested. It never
    authenticates anything. Replacing it is a deliberate act that requires
    evidence from a real provider test transport.
    """

    def __init__(self, provider: str) -> None:
        self.provider = provider

    def verify(
        self,
        request: InboundReportRequest,
        connection: IntegrationConnection,
    ) -> None:
        raise AuthenticationNotConfigured(self.provider)
