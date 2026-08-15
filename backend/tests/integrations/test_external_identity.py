"""The external identity crosswalk: mapping states and isolation."""

from __future__ import annotations

import pytest

from integrations.identities import (
    CanonicalEntityType,
    ExternalIdentity,
    MappingState,
    unresolved_identity,
)

from .conftest import CONNECTION_ID, ORG_ID, OTHER_ORG_ID

OTHER_CONNECTION_ID = "44444444-4444-4444-4444-444444444444"

#: A VendSoft-style machine code. Short, and the kind of value that is unique
#: only within one account.
VENDSOFT_MACHINE_CODE = "M-014"


def seen(**overrides) -> ExternalIdentity:
    fields = {
        "org_id": ORG_ID,
        "connection_id": CONNECTION_ID,
        "entity_type": "machine",
        "external_id": VENDSOFT_MACHINE_CODE,
        "canonical_entity_type": CanonicalEntityType.MACHINE,
    }
    fields.update(overrides)
    return unresolved_identity(**fields)


class TestMappingStates:
    def test_unresolved_is_representable(self) -> None:
        """The state that stops us guessing or discarding."""
        identity = seen()
        assert identity.mapping_state is MappingState.UNRESOLVED
        assert identity.canonical_entity_id is None
        assert identity.is_resolved is False

    def test_resolved_points_at_a_canonical_entity(self) -> None:
        identity = seen().resolve_to("smartvend-machine-1")
        assert identity.mapping_state is MappingState.RESOLVED
        assert identity.canonical_entity_id == "smartvend-machine-1"
        assert identity.canonical_entity_type is CanonicalEntityType.MACHINE

    def test_ambiguous_is_representable(self) -> None:
        identity = seen().mark_ambiguous()
        assert identity.mapping_state is MappingState.AMBIGUOUS

    def test_ambiguous_drops_any_canonical_association(self) -> None:
        """Otherwise ambiguous is indistinguishable from resolved."""
        identity = seen().resolve_to("smartvend-machine-1").mark_ambiguous()
        assert identity.canonical_entity_id is None

    def test_resolved_requires_a_canonical_id(self) -> None:
        with pytest.raises(ValueError):
            ExternalIdentity(
                id="i",
                org_id=ORG_ID,
                connection_id=CONNECTION_ID,
                entity_type="machine",
                external_id=VENDSOFT_MACHINE_CODE,
                canonical_entity_type=CanonicalEntityType.MACHINE,
                mapping_state=MappingState.RESOLVED,
            )

    @pytest.mark.parametrize(
        "state", [MappingState.UNRESOLVED, MappingState.AMBIGUOUS]
    )
    def test_unmapped_states_cannot_carry_a_canonical_id(
        self, state: MappingState
    ) -> None:
        """A half-resolved record forces every consumer to guess."""
        with pytest.raises(ValueError):
            ExternalIdentity(
                id="i",
                org_id=ORG_ID,
                connection_id=CONNECTION_ID,
                entity_type="machine",
                external_id=VENDSOFT_MACHINE_CODE,
                canonical_entity_type=CanonicalEntityType.MACHINE,
                mapping_state=state,
                canonical_entity_id="smartvend-machine-1",
            )

    def test_resolution_does_not_mutate_the_original(self) -> None:
        original = seen()
        original.resolve_to("smartvend-machine-1")
        assert original.mapping_state is MappingState.UNRESOLVED


class TestUniquenessScope:
    def test_key_is_connection_entity_type_and_external_id(self) -> None:
        assert seen().key == (CONNECTION_ID, "machine", VENDSOFT_MACHINE_CODE)

    def test_same_external_id_can_exist_under_different_connections(self) -> None:
        """Two customers may legitimately use the same provider code."""
        a = seen()
        b = seen(connection_id=OTHER_CONNECTION_ID, org_id=OTHER_ORG_ID)

        assert a.external_id == b.external_id
        assert a.key != b.key
        assert a.id != b.id

    def test_same_external_id_differs_by_entity_type(self) -> None:
        """A provider may reuse one code for a machine and for a terminal."""
        assert seen().key != seen(entity_type="terminal").key

    def test_external_id_is_never_the_smartvend_key(self) -> None:
        identity = seen().resolve_to("smartvend-machine-1")
        assert identity.id != identity.external_id
        assert identity.canonical_entity_id != identity.external_id

    def test_entity_type_is_normalized(self) -> None:
        assert seen(entity_type="  Machine ").entity_type == "machine"


class TestOrganizationIsolation:
    def test_org_id_is_carried_explicitly(self) -> None:
        """Defense in depth: filtering must not depend on a join being right."""
        assert seen().org_id == ORG_ID

    def test_identities_in_different_orgs_are_distinct_records(self) -> None:
        a = seen()
        b = seen(org_id=OTHER_ORG_ID, connection_id=OTHER_CONNECTION_ID)
        assert a.org_id != b.org_id
        assert a.key != b.key


class TestProviderVocabularyStaysAsData:
    @pytest.mark.parametrize(
        "provider_term", ["terminal", "coil", "batch", "ap_code", "device"]
    )
    def test_provider_terms_are_values_not_schema(self, provider_term: str) -> None:
        """No SeedLiveMachine/VendSoftMachine tables, and no per-provider columns."""
        identity = seen(entity_type=provider_term)
        assert identity.entity_type == provider_term
        assert identity.canonical_entity_type is CanonicalEntityType.MACHINE

    def test_canonical_targets_are_restricted_to_approved_entities(self) -> None:
        """ADR-0003's canonical set, nothing invented alongside it."""
        assert {t.value for t in CanonicalEntityType} == {
            "location",
            "machine",
            "product",
            "slot",
            "vend_transaction",
            "vend_transaction_line",
        }

    def test_organization_is_not_a_crosswalk_target(self) -> None:
        """Org ownership comes from the connection, never from a mapping."""
        assert not hasattr(CanonicalEntityType, "ORGANIZATION")


class TestBothSourcesResolveIntoOneCanonicalModel:
    """The MVP proof: VendSoft and Seed Live point at the same canonical model."""

    def test_vendsoft_location_resolves_to_a_canonical_location(self) -> None:
        """VendSoft migration carries client site structure, not just machines."""
        identity = seen(
            entity_type="site",
            external_id="LOC-CENTRAL-01",
            canonical_entity_type=CanonicalEntityType.LOCATION,
        ).resolve_to("smartvend-location-7")

        assert identity.canonical_entity_type is CanonicalEntityType.LOCATION
        assert identity.canonical_entity_id == "smartvend-location-7"
        assert identity.external_id == "LOC-CENTRAL-01"
        # The provider's own word for it stays a value, not a schema concept.
        assert identity.entity_type == "site"

    def test_two_providers_resolve_to_the_same_canonical_machine(self) -> None:
        """One SmartVend Machine, reached from both migration and live feed."""
        from_vendsoft = seen(
            entity_type="machine", external_id="M-014"
        ).resolve_to("smartvend-machine-1")
        from_seedlive = seen(
            connection_id=OTHER_CONNECTION_ID,
            entity_type="device",
            external_id="884213",
        ).resolve_to("smartvend-machine-1")

        assert from_vendsoft.canonical_entity_id == from_seedlive.canonical_entity_id
        assert from_vendsoft.external_id != from_seedlive.external_id
        assert from_vendsoft.key != from_seedlive.key


class TestEvidenceLink:
    def test_identity_can_cite_the_artifact_it_was_seen_in(self) -> None:
        identity = seen(source_artifact_id="artifact-1")
        assert identity.source_artifact_id == "artifact-1"

    def test_evidence_link_is_optional(self) -> None:
        assert seen().source_artifact_id is None
