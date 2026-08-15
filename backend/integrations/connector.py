"""The live provider connector boundary.

One implementation per provider. Adding Nayax means adding one class here, not
a new pipeline. Customer-specific behavior lives in the connection record.

A connector identifies and parses payloads. It never writes canonical records
directly, never resolves identity ambiguity on its own, and never calls an LLM.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from integrations.artifacts import UNKNOWN_REPORT_TYPE
from integrations.connections import IntegrationConnection
from integrations.inbound import InboundReportRequest
from integrations.providers import Provider

#: Recorded when a payload matches no layout SmartVend recognises. Lives in the
#: provider-neutral layer so every connector shares one sentinel; the concrete
#: schema identifiers belong to each provider's own package.
UNKNOWN_SCHEMA = "unknown"


@dataclass(frozen=True)
class ReportIdentification:
    """The connector's conclusion about what a payload is.

    `confident` is False when the type was guessed from a weak signal such as a
    transport-declared name that we cannot yet corroborate. An unconfident
    identification is still recorded, and still preserved, but must not be used
    to select a parser.

    `schema_id` is **SmartVend's** identifier for a payload layout we have
    actually observed and know how to read. It is our contract version, not a
    provider-published one. `report_version` stays reserved for a version the
    *provider* declares, and is None because no provider version has ever been
    observed; the two must not be conflated.
    """

    report_type: str = UNKNOWN_REPORT_TYPE
    report_version: str | None = None
    confident: bool = False
    schema_id: str = UNKNOWN_SCHEMA

    @property
    def is_known(self) -> bool:
        return self.report_type != UNKNOWN_REPORT_TYPE

    @property
    def has_known_schema(self) -> bool:
        """Whether the payload layout is one we recognise.

        Distinct from `is_known`: a report type can be named by a hint while
        its layout is still unrecognised, and only a recognised layout may
        ever select a parser.
        """
        return self.schema_id != UNKNOWN_SCHEMA


class ReportParsingNotVerified(NotImplementedError):
    """Parsing is not implemented because the schema is not verified.

    Raised instead of returning a guessed structure. A parser written against
    an assumed schema would silently produce wrong canonical data, which is
    worse than no parser at all.
    """

    def __init__(self, provider: str, report_type: str) -> None:
        super().__init__(
            f"no verified parser for {provider} report type {report_type!r}. "
            "The schema must be captured from a real provider delivery before "
            "a parser is written."
        )
        self.provider = provider
        self.report_type = report_type


class LiveProviderConnector(Protocol):
    """Contract every live provider implementation satisfies."""

    @property
    def provider(self) -> Provider:
        """The provider this connector serves."""
        ...

    def supported_report_types(self) -> frozenset[str]:
        """Report types this connector knows about.

        Membership means the type is recognised, not that a verified parser
        exists for it.
        """
        ...

    def identify(
        self,
        request: InboundReportRequest,
        connection: IntegrationConnection,
    ) -> ReportIdentification:
        """Determine what the payload is.

        Must return an unknown identification rather than guessing. Must never
        raise for an unrecognised payload: the artifact is still preserved.
        """
        ...

    def parse(
        self,
        request: InboundReportRequest,
        identification: ReportIdentification,
        connection: IntegrationConnection,
    ) -> object:
        """Parse a payload into typed provider records.

        Raises `ReportParsingNotVerified` while the schema is unverified.
        """
        ...
