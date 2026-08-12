"""Live provider integrations.

This package holds the provider-neutral boundary for live operational
providers such as Cantaloupe / Seed Live, and one subpackage per provider.

Design rules, from docs/gameplans/SMARTVEND_PLATFORM_ARCHITECTURE_AND_SEEDLIVE_MVP.md:

- One connector implementation per provider, many connection records per
  customer. Customer-specific behavior lives in configuration, never in code.
- External provider identifiers are never SmartVend primary keys.
- Raw evidence is preserved before any transformation.
- Ingestion is deterministic. No LLM sits in this path.
- Tenant identity comes from the resolved connection, never from payload
  content.

Everything in this package except `cantaloupe.routes` is importable without a
database, without environment configuration, and without network access. That
is deliberate: it keeps the contract testable. `cantaloupe.routes` depends on
the FastAPI application stack and is imported separately.
"""
