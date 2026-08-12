# SmartVend context

Compiled knowledge for this project. Project-owned; EVO never overwrites this
file. Verified facts only, with the evidence noted. No credentials, account
identifiers, or customer data.

Last verified: 2026-08-12, against `origin/main` at
`204a4bb46bc1969704f6ea0045a9527042385a89`.

## Identity

| | |
| --- | --- |
| Project | SmartVend |
| Workstream | Platform Architecture and Seed Live Integration |
| Owner | Angel |
| Active gameplan | `docs/gameplans/SMARTVEND_PLATFORM_ARCHITECTURE_AND_SEEDLIVE_MVP.md` |
| Active branch | `feat/seedlive-integration` |
| Parallel workstream | Ganesh: SmartVend foundation and VendSoft historical migration |
| Repository | `https://github.com/SSG-YERRAMSETTI/SmartVend.git`, **public** |
| EVO version | 0.1.1, source commit `6ac9f2d20f2cda8bf335d20031640cd6f6d9396a` |

**Read the active gameplan at the start of every session.** It defines scope,
architecture direction, open decisions, and the current milestone. This file
does not duplicate it.

## Purpose

The SmartVend Onboarding Platform onboards a vending operator from their
existing technology ecosystem into SmartVend. It covers historical migration
sources such as VendSoft, and live operational providers such as Cantaloupe /
Seed Live, normalizing both into one provider-neutral canonical model.

This workstream owns the platform layer: canonical model, tenancy, external
identity, connections, raw evidence, live provider integration, orchestration,
deterministic reconciliation, and AWS architecture.

## Current architecture, verified

Full detail in `docs/architecture/SMARTVEND_CURRENT_STATE_AUDIT.md`.

- **Frontend.** React and TypeScript on Vite, Tailwind and shadcn/ui,
  react-router-dom, TanStack Query. 165 TS/TSX files.
- **Backend.** FastAPI with seven routers, SQLAlchemy with 37 mapped tables,
  JWT auth using PyJWT and bcrypt. 28 Python modules.
- **Two business-data paths coexist.** 11 of 19 frontend hooks read and write
  through Supabase directly, covering machines, locations, inventory, sales,
  routes, telemetry, reports, dashboard, admin, audit logs and API keys. 4 hooks
  go through FastAPI. Core domains bypass the backend today.
- **Authentication** runs through FastAPI, not Supabase, though the Supabase
  client is still configured to persist sessions.

## Accepted architectural constraints

**ADR-0001: business data is consolidated behind FastAPI and PostgreSQL.**
Accepted, not open.

- Target application path: **React to FastAPI to PostgreSQL**. No direct
  frontend business-data access to Supabase.
- Development: local PostgreSQL. Production target: Amazon RDS PostgreSQL, which
  is an intended target and **not** current verified infrastructure.
- Current Supabase business-data access is legacy technical debt to be migrated,
  owned by the consolidation workstream. This workstream designs against the
  target and does not refactor those hooks.
- Authentication is evaluated separately and no auth decision follows from this.

## Data stores

- **PostgreSQL** behind FastAPI via `DATABASE_URL`. The target store for all
  business data.
- **Supabase PostgreSQL**, project directory `clouddata/` with 8 SQL migrations
  and a Deno edge function. Currently still the primary path for most domains.
  Legacy, being retired per ADR-0001.
- Three competing schema definitions: `backend/schema.sql` with 38 tables,
  `backend/models.py` with 37, `clouddata/migrations` with 27. None is
  designated authoritative.
- Alembic is pinned in `requirements.txt` but never initialized. There is no
  `alembic.ini` and no versions directory.

## Integrations

| System | State |
| --- | --- |
| Supabase | Present and in use, despite README and SETUP.md claiming removal. Being retired from business-data access per ADR-0001 |
| Anthropic Claude | Present, backend receipt and assistant reasoning |
| Google Gemini | Present, backend receipt AI |
| VendSoft | Not on main. Preserved on `chore/preserve-vendsoft-wip`. Ganesh owns it |
| Cantaloupe / Seed Live | Not present. This workstream starts from nothing |
| Nayax | Not present |

## Environments

Only local development is evidenced. No AWS, Docker, CI, or deployment
configuration exists anywhere in the repository. No production infrastructure is
described. Treat any claim of a staging or production environment as unverified
until audited.

## Constraints

- The repository is **public**. No customer data, credentials, or secrets.
- The backend requires 11 environment variables and there is no
  `.env.example` on main documenting them.
- The backend does not currently import: `sqlalchemy`, `alembic`, `passlib` and
  `jwt` are missing from the environment and no virtualenv is committed.
- No automated tests exist on main.
- Two engineers work in parallel. The canonical model is a shared contract;
  changes to it require both owners and an ADR.

## Known external identity constraint

External provider identifiers are never SmartVend primary keys. All external
identity resolves through a crosswalk. Whether `productCode` or any provider
code is unique remains unverified and must be tested against real data.

## Security posture

Inherited findings, detailed as S1 to S8 in the audit. The most important:
a real `DATABASE_URL` is reachable in public Git history at commit `4879cf5`
and must be treated as compromised; a PostgreSQL dump, seed spreadsheets with
real customer site names, and real receipt images are committed to a public
repository. Remediation is gameplan decision D6 and requires human action.

## Evidence

- Current state: `docs/architecture/SMARTVEND_CURRENT_STATE_AUDIT.md`
- Target design: `docs/architecture/SMARTVEND_TARGET_ARCHITECTURE.md`
- Plan and open decisions: the active gameplan
- Validation commands and known gaps: `.evo/project/config.toml`
- Decisions: `.evo/project/decisions/`
