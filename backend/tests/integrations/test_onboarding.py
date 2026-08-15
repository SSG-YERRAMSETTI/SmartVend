"""Onboarding runs: coverage counters and the migration proof shape."""

from __future__ import annotations

import pytest

from integrations.onboarding import (
    DatasetCounters,
    OnboardingDataset,
    OnboardingRun,
    OnboardingRunStatus,
    start_run,
)
from integrations.providers import Provider

from .conftest import ORG_ID, OTHER_ORG_ID


def dataset(key: str, provider: Provider, **counters) -> OnboardingDataset:
    return OnboardingDataset(
        dataset_key=key,
        provider=provider,
        counters=DatasetCounters(**counters),
        artifact_ids=(f"artifact-{key}",),
    )


class TestOwnership:
    def test_run_belongs_to_exactly_one_org(self) -> None:
        run = start_run(org_id=ORG_ID)
        assert run.org_id == ORG_ID

    def test_runs_in_different_orgs_are_distinct(self) -> None:
        assert start_run(org_id=ORG_ID).org_id != start_run(org_id=OTHER_ORG_ID).org_id

    def test_org_id_is_required(self) -> None:
        with pytest.raises(ValueError):
            start_run(org_id="")


class TestDatasets:
    def test_run_references_multiple_source_datasets(self) -> None:
        """The MVP proof: VendSoft history plus Seed Live evidence in one run."""
        run = start_run(
            org_id=ORG_ID,
            datasets=(
                dataset("machines", Provider.VENDSOFT, discovered=14, processed=14, mapped=14),
                dataset("products", Provider.VENDSOFT, discovered=120, processed=120, mapped=120),
                dataset("planogram_slots", Provider.VENDSOFT, discovered=560, processed=560, mapped=540, unresolved=20),
                dataset("transactions", Provider.CANTALOUPE, discovered=88, processed=88, mapped=0, unresolved=88),
            ),
        )

        assert len(run.datasets) == 4
        assert run.source_systems == (Provider.VENDSOFT, Provider.CANTALOUPE)

    def test_source_systems_is_derived_not_stored(self) -> None:
        """So it cannot drift from the evidence actually attached."""
        run = start_run(org_id=ORG_ID, datasets=(dataset("machines", Provider.VENDSOFT),))
        assert run.source_systems == (Provider.VENDSOFT,)

        run = run.with_dataset(dataset("transactions", Provider.CANTALOUPE))
        assert run.source_systems == (Provider.VENDSOFT, Provider.CANTALOUPE)

    def test_datasets_carry_their_artifact_evidence(self) -> None:
        run = start_run(
            org_id=ORG_ID,
            datasets=(
                dataset("machines", Provider.VENDSOFT),
                dataset("transactions", Provider.CANTALOUPE),
            ),
        )
        assert run.artifact_ids == ("artifact-machines", "artifact-transactions")

    def test_dataset_key_is_unique_within_a_run(self) -> None:
        with pytest.raises(ValueError):
            start_run(
                org_id=ORG_ID,
                datasets=(
                    dataset("machines", Provider.VENDSOFT),
                    dataset("machines", Provider.CANTALOUPE),
                ),
            )

    def test_with_dataset_replaces_by_key(self) -> None:
        run = start_run(org_id=ORG_ID, datasets=(dataset("machines", Provider.VENDSOFT, discovered=1, processed=1, mapped=1),))
        run = run.with_dataset(dataset("machines", Provider.VENDSOFT, discovered=9, processed=9, mapped=9))

        assert len(run.datasets) == 1
        assert run.totals.discovered == 9


class TestCounters:
    def test_mapped_unresolved_failed_are_representable(self) -> None:
        counters = DatasetCounters(
            discovered=100, processed=100, mapped=70, unresolved=20, failed=10
        )
        assert (counters.mapped, counters.unresolved, counters.failed) == (70, 20, 10)

    def test_totals_sum_across_datasets(self) -> None:
        run = start_run(
            org_id=ORG_ID,
            datasets=(
                dataset("machines", Provider.VENDSOFT, discovered=10, processed=10, mapped=10),
                dataset("transactions", Provider.CANTALOUPE, discovered=90, processed=90, mapped=60, unresolved=30),
            ),
        )
        totals = run.totals
        assert totals.discovered == 100
        assert totals.mapped == 70
        assert totals.unresolved == 30

    def test_outcomes_cannot_exceed_processed(self) -> None:
        """Catches double-counting rather than reporting impossible coverage."""
        with pytest.raises(ValueError):
            DatasetCounters(discovered=10, processed=10, mapped=8, unresolved=5)

    def test_processed_cannot_exceed_discovered(self) -> None:
        with pytest.raises(ValueError):
            DatasetCounters(discovered=5, processed=6)

    def test_counters_reject_negatives(self) -> None:
        with pytest.raises(ValueError):
            DatasetCounters(discovered=-1)


class TestLifecycle:
    def test_clean_run_completes(self) -> None:
        run = start_run(
            org_id=ORG_ID,
            datasets=(dataset("machines", Provider.VENDSOFT, discovered=10, processed=10, mapped=10),),
        ).conclude()

        assert run.status is OnboardingRunStatus.COMPLETED
        assert run.completed_at is not None

    def test_unresolved_records_produce_completed_with_gaps(self) -> None:
        """The Seed Live case: transactions land, selections stay unmapped."""
        run = start_run(
            org_id=ORG_ID,
            datasets=(dataset("transactions", Provider.CANTALOUPE, discovered=88, processed=88, unresolved=88),),
        ).conclude()

        assert run.status is OnboardingRunStatus.COMPLETED_WITH_GAPS
        assert run.has_gaps is True

    def test_failed_records_produce_completed_with_gaps(self) -> None:
        run = start_run(
            org_id=ORG_ID,
            datasets=(dataset("products", Provider.VENDSOFT, discovered=10, processed=10, mapped=9, failed=1),),
        ).conclude()
        assert run.status is OnboardingRunStatus.COMPLETED_WITH_GAPS

    def test_unprocessed_discovered_records_are_a_gap(self) -> None:
        """Silently dropping the tail of an export is the failure to catch."""
        run = start_run(
            org_id=ORG_ID,
            datasets=(dataset("machines", Provider.VENDSOFT, discovered=10, processed=4, mapped=4),),
        ).conclude()
        assert run.status is OnboardingRunStatus.COMPLETED_WITH_GAPS

    def test_status_is_decided_by_counters_not_asserted(self) -> None:
        """A caller cannot claim a clean completion over unresolved records."""
        run = start_run(
            org_id=ORG_ID,
            datasets=(dataset("transactions", Provider.CANTALOUPE, discovered=1, processed=1, unresolved=1),),
        )
        assert run.conclude().status is not OnboardingRunStatus.COMPLETED

    def test_run_can_fail(self) -> None:
        run = start_run(org_id=ORG_ID).fail()
        assert run.status is OnboardingRunStatus.FAILED

    def test_lifecycle_states_are_exactly_the_mvp_set(self) -> None:
        assert {s.value for s in OnboardingRunStatus} == {
            "pending",
            "running",
            "completed",
            "completed_with_gaps",
            "failed",
        }

    def test_a_new_run_starts_pending(self) -> None:
        run = OnboardingRun(id="r", org_id=ORG_ID)
        assert run.status is OnboardingRunStatus.PENDING
        assert run.completed_at is None
