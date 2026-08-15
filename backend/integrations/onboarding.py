"""Onboarding runs: the record of one migration or proof run.

Scope is deliberately small. This is **not** the Master Onboarding
Orchestrator and **not** the Migration Coverage Manifest, both of which are
later work. It is the minimum needed to answer, for one client onboarding:

    what did we try to load, how much landed, how much is still unmapped,
    and which preserved artifacts prove it?

A run groups datasets. A dataset is one logical export or feed — VendSoft
machines, VendSoft products, VendSoft planogram slots, Seed Live transaction
evidence — and carries the counters and the artifact references for that
source.

Counters are the whole point. A migration that reports only success is not
evidence; a migration that reports what stayed unresolved is.

Nothing here persists.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import Enum
from typing import Protocol
from uuid import uuid4

from integrations.inbound import utc_now
from integrations.providers import Provider


class OnboardingRunStatus(str, Enum):
    """Lifecycle of one onboarding run."""

    PENDING = "pending"
    RUNNING = "running"
    #: Everything discovered was processed and mapped.
    COMPLETED = "completed"
    #: Finished, but records remain unresolved or failed. Still a usable
    #: outcome: gaps are reported rather than hidden behind a green check.
    COMPLETED_WITH_GAPS = "completed_with_gaps"
    #: The run itself failed; counters may be partial.
    FAILED = "failed"


@dataclass(frozen=True)
class DatasetCounters:
    """Coverage for one dataset.

    `discovered` is what the source appeared to contain. `processed` is what we
    actually handled. The remainder splits into mapped, unresolved, and failed.
    """

    discovered: int = 0
    processed: int = 0
    mapped: int = 0
    unresolved: int = 0
    failed: int = 0

    def __post_init__(self) -> None:
        for name in ("discovered", "processed", "mapped", "unresolved", "failed"):
            value = getattr(self, name)
            if not isinstance(value, int) or isinstance(value, bool):
                raise TypeError(f"{name} must be an int")
            if value < 0:
                raise ValueError(f"{name} must not be negative")

        # A control check, not an accounting identity. Outcomes may exceed
        # nothing, but they cannot exceed what was processed without meaning
        # something has been double-counted.
        outcomes = self.mapped + self.unresolved + self.failed
        if outcomes > self.processed:
            raise ValueError(
                "mapped + unresolved + failed cannot exceed processed"
            )
        if self.processed > self.discovered:
            raise ValueError("processed cannot exceed discovered")

    @property
    def has_gaps(self) -> bool:
        """True when anything did not land cleanly.

        Unprocessed discovered records count as a gap: silently dropping the
        tail of an export is exactly the failure this is meant to surface.
        """
        return (
            self.unresolved > 0
            or self.failed > 0
            or self.processed < self.discovered
        )

    def plus(self, other: "DatasetCounters") -> "DatasetCounters":
        return DatasetCounters(
            discovered=self.discovered + other.discovered,
            processed=self.processed + other.processed,
            mapped=self.mapped + other.mapped,
            unresolved=self.unresolved + other.unresolved,
            failed=self.failed + other.failed,
        )


@dataclass(frozen=True)
class OnboardingDataset:
    """One logical source within a run, with its evidence and coverage.

    `dataset_key` is free text so a new export type does not require a schema
    change: "machines", "products", "planogram_slots", "transactions".
    """

    dataset_key: str
    provider: Provider
    counters: DatasetCounters = field(default_factory=DatasetCounters)
    #: Preserved `RawReportArtifact` ids backing this dataset. Evidence, not
    #: payload: the artifacts hold the bytes.
    artifact_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not isinstance(self.dataset_key, str) or not self.dataset_key.strip():
            raise ValueError("dataset_key must be a non-empty string")
        object.__setattr__(self, "dataset_key", self.dataset_key.strip().lower())
        object.__setattr__(self, "artifact_ids", tuple(self.artifact_ids))

    @property
    def has_gaps(self) -> bool:
        return self.counters.has_gaps


@dataclass(frozen=True)
class OnboardingRun:
    """One client onboarding or migration proof run.

    Belongs to exactly one organization. `source_systems` is derived from the
    datasets rather than stored, so it cannot drift out of agreement with the
    evidence actually attached.
    """

    id: str
    org_id: str
    status: OnboardingRunStatus = OnboardingRunStatus.PENDING
    started_at: datetime = field(default_factory=utc_now)
    completed_at: datetime | None = None
    datasets: tuple[OnboardingDataset, ...] = ()

    def __post_init__(self) -> None:
        for name in ("id", "org_id"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name} must be a non-empty string")
        object.__setattr__(self, "datasets", tuple(self.datasets))

        keys = [d.dataset_key for d in self.datasets]
        if len(keys) != len(set(keys)):
            raise ValueError("dataset_key must be unique within a run")

        if self.completed_at is not None and self.completed_at.tzinfo is None:
            raise ValueError("completed_at must be timezone-aware")
        if self.started_at.tzinfo is None:
            raise ValueError("started_at must be timezone-aware")

    @property
    def source_systems(self) -> tuple[Provider, ...]:
        """Distinct providers contributing evidence, in first-seen order."""
        seen: list[Provider] = []
        for dataset in self.datasets:
            if dataset.provider not in seen:
                seen.append(dataset.provider)
        return tuple(seen)

    @property
    def totals(self) -> DatasetCounters:
        """Run-wide coverage, summed across datasets."""
        total = DatasetCounters()
        for dataset in self.datasets:
            total = total.plus(dataset.counters)
        return total

    @property
    def artifact_ids(self) -> tuple[str, ...]:
        return tuple(a for d in self.datasets for a in d.artifact_ids)

    @property
    def has_gaps(self) -> bool:
        return any(d.has_gaps for d in self.datasets)

    def with_dataset(self, dataset: OnboardingDataset) -> "OnboardingRun":
        """Return a copy with the dataset added or replaced by `dataset_key`."""
        others = tuple(d for d in self.datasets if d.dataset_key != dataset.dataset_key)
        return replace(self, datasets=others + (dataset,))

    def conclude(self, *, now: datetime | None = None) -> "OnboardingRun":
        """Finish the run, choosing COMPLETED or COMPLETED_WITH_GAPS.

        The distinction is decided from the counters, not asserted by a caller.
        A run with unresolved or failed records must not be able to claim it
        completed cleanly.
        """
        status = (
            OnboardingRunStatus.COMPLETED_WITH_GAPS
            if self.has_gaps
            else OnboardingRunStatus.COMPLETED
        )
        return replace(self, status=status, completed_at=now or utc_now())

    def fail(self, *, now: datetime | None = None) -> "OnboardingRun":
        return replace(
            self, status=OnboardingRunStatus.FAILED, completed_at=now or utc_now()
        )


def start_run(
    *,
    org_id: str,
    datasets: tuple[OnboardingDataset, ...] = (),
    run_id_factory=lambda: str(uuid4()),
    now: datetime | None = None,
) -> OnboardingRun:
    return OnboardingRun(
        id=run_id_factory(),
        org_id=org_id,
        status=OnboardingRunStatus.RUNNING,
        started_at=now or utc_now(),
        datasets=datasets,
    )


class OnboardingRunStore(Protocol):
    """Persists onboarding runs. Storage decision not settled."""

    def save(self, run: OnboardingRun) -> OnboardingRun: ...

    def get(self, *, org_id: str, run_id: str) -> OnboardingRun | None:
        """Return the run, scoped by organization so a run id alone is not
        sufficient to read another organization's migration evidence."""
        ...
