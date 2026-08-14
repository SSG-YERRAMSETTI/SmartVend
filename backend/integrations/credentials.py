"""Connection-scoped credential resolution.

A connection stores a `credential_ref`, never a secret. This module defines how
a reference is exchanged for secret material at request time.

The production direction is AWS Secrets Manager. That is deliberately not
implemented here: no AWS infrastructure exists, and the contract is what the
authenticator depends on, not the backing store.

Secret material lives in memory for the duration of a verification and is never
logged, never persisted into an artifact, and never rendered by a `repr`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class BasicCredential:
    """A username and password pair for HTTP Basic authentication.

    SmartVend policy requires both parts to be non-empty. RFC 7617 permits an
    empty password, so this is deliberately stricter than the standard:
    accepting one here would let a misconfigured connection authenticate on a
    blank secret, so it is rejected as configuration error.
    """

    username: str
    password: str = field(repr=False)

    def __post_init__(self) -> None:
        if not self.username:
            raise ValueError("credential username must not be empty")
        if not self.password:
            raise ValueError("credential password must not be empty")

    def __repr__(self) -> str:  # pragma: no cover - trivial
        # Explicit, so a password cannot reach a traceback or a log line
        # through the default dataclass repr.
        return f"BasicCredential(username={self.username!r}, password=<redacted>)"

    __str__ = __repr__


class CredentialNotFound(LookupError):
    """No credential is configured, or the reference does not resolve.

    The message never contains the reference's resolved value.
    """

    def __init__(self, credential_ref: str | None = None) -> None:
        super().__init__("credential could not be resolved")
        self.credential_ref = credential_ref


class CredentialProviderUnavailable(RuntimeError):
    """The backing secret store could not be reached.

    Distinct from `CredentialNotFound` so operations can tell a missing secret
    from a broken store. Both fail closed, and both look identical to a caller.
    """

    def __init__(self, reason: str = "credential provider unavailable") -> None:
        super().__init__(reason)


class CredentialProvider(Protocol):
    """Exchanges a connection's credential reference for secret material."""

    def resolve_basic(self, credential_ref: str) -> BasicCredential:
        """Return the credential for this reference.

        Raises `CredentialNotFound` when the reference does not resolve, or
        `CredentialProviderUnavailable` when the store cannot be reached.

        Implementations must not log the secret, must not cache it beyond what
        the backing store's own semantics allow, and must never return a
        partially populated credential.
        """
        ...
