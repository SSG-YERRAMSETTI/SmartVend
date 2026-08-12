"""Provider identity.

A provider is an external system SmartVend integrates with. There is exactly
one connector implementation per provider, and many connection records per
provider, one for each customer relationship.
"""

from __future__ import annotations

from enum import Enum


class Provider(str, Enum):
    """External systems SmartVend integrates with.

    String-valued so the identifier is stable in storage and in URLs.
    """

    CANTALOUPE = "cantaloupe"
    NAYAX = "nayax"
    VENDSOFT = "vendsoft"

    @classmethod
    def parse(cls, value: str) -> "Provider":
        try:
            return cls(value.strip().lower())
        except ValueError as exc:
            raise UnknownProvider(value) from exc


class ProviderKind(str, Enum):
    """How a provider delivers data.

    Historical and live are different concerns with different failure modes.
    They share the canonical model and the identity crosswalk, not a pipeline.
    """

    #: One-time migration of a finite history.
    HISTORICAL = "historical"
    #: Continuous delivery of new data after configuration.
    LIVE = "live"


#: Which kind each provider is used for today. A provider could in principle
#: serve both; none does yet, and inventing that generality now would be
#: speculation.
PROVIDER_KINDS: dict[Provider, ProviderKind] = {
    Provider.CANTALOUPE: ProviderKind.LIVE,
    Provider.NAYAX: ProviderKind.LIVE,
    Provider.VENDSOFT: ProviderKind.HISTORICAL,
}


class UnknownProvider(ValueError):
    """Raised when a provider identifier is not recognised."""

    def __init__(self, value: str) -> None:
        super().__init__(f"unknown provider: {value!r}")
        self.value = value
