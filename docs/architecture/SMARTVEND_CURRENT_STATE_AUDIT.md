# SmartVend current state audit

CURRENT STATE ONLY. This document records what the repository actually
contains. It does not describe intended or future architecture. Target design
lives in `SMARTVEND_TARGET_ARCHITECTURE.md` and the active gameplan.

- Audit date: 2026-08-12
- Audited base commit: `204a4bb46bc1969704f6ea0045a9527042385a89` (`origin/main`)
- Active branch: `feat/seedlive-integration`, created from that commit
- Method: inspection of tracked content on current `origin/main`, plus execution
  of the frontend toolchain. The `dev` branch and the preserved VendSoft branch
  were explicitly excluded as sources of truth.

Evidence levels used below: VERIFIED (observed directly in tracked content or by
running a command), PARTIALLY VERIFIED, NOT VERIFIED, CONTRADICTED.

## 1. Headline findings

1. **Supabase is still present and actively used.** The README and SETUP.md
   state that Supabase was removed. The code contradicts this. CONTRADICTED.
2. **Two independent business-data paths exist.** Most domain data flows
   React to Supabase directly. A minority flows React to FastAPI to PostgreSQL.
   VERIFIED.
3. **There are no automated tests anywhere on main.** VERIFIED.
4. **Alembic is declared but never initialized.** VERIFIED.
5. **Three competing schema definitions exist.** VERIFIED.
6. **A PostgreSQL database dump, real customer location names, and real receipt
   images are committed to a public repository.** VERIFIED.
7. **No AWS, Docker, or CI configuration exists.** VERIFIED.

## 2. Repository structure

| Area | Tracked files | Notes |
| --- | --- | --- |
| `src/` | 168 | React + TypeScript frontend |
| `backend/` | 44 | FastAPI application, 28 Python modules |
| `receiptsSample/` | 17 | Real receipt images and PDFs |
| `clouddata/` | 10 | Supabase project: config, edge function, 8 SQL migrations |
| `localdb/` | 1 | `SmartVendDatabase.backup`, PostgreSQL custom dump |
| `public/` | 3 | Static assets |
| root | 15 | Vite, TypeScript, Tailwind, ESLint config, `requirements.txt` |

No `tests/`, no `.github/`, no `Dockerfile`, no `alembic.ini`, no
infrastructure-as-code.

## 3. Frontend

VERIFIED.

- React with TypeScript, built by Vite, styled with Tailwind and shadcn/ui.
  Routing via `react-router-dom`, server state via `@tanstack/react-query`.
- 165 `.ts`/`.tsx` files: 99 components, 35 pages, 19 hooks, 6 lib modules.
- `package.json` declares no `test` and no `typecheck` script. Scripts are
  `dev`, `build`, `build:dev`, `lint`, `preview`.

### 3.1 Frontend data paths

Two paths coexist. This is the single most important structural finding.

**Path A: React to Supabase, directly.** VERIFIED.

`src/integrations/supabase/client.ts` constructs a Supabase client from
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, with
`persistSession: true` and `localStorage` storage. 18 files import it. 145
references to Supabase exist under `src/`.

Hooks reading or writing business data through Supabase (11 of 19):

`useAdmin`, `useApiKeys`, `useAuditLogs`, `useDashboardData`, `useInventory`,
`useLocations`, `useMachines`, `useOfflineSync`, `useReports`, `useRoutes`,
`useSales`, `useTelemetry`

Components importing it directly: `AuditLogDrawer`, `CSVImportDialog`,
`MachineCSVImportDialog`, `PlanogramCSVImportDialog`, `PlanogramEditor`.

**Path B: React to FastAPI.** VERIFIED.

`src/config/api.ts` sets `API_BASE_URL` from `VITE_API_BASE_URL`, defaulting to
`http://localhost:8000`. `src/lib/apiClient.ts` wraps it. Hooks using it:
`useApi`, `useProfitAnalytics`, `useRestockRecommendations`,
`useWarehouseInventory`.

So core operational domains, machines, locations, inventory, sales, routes and
telemetry, currently bypass the backend entirely.

### 3.2 Authentication

PARTIALLY VERIFIED. Authentication itself has moved to the backend, but
Supabase auth machinery remains configured.

- `src/hooks/useAuth.tsx` authenticates against FastAPI through `apiClient`,
  holding a bearer token, and models `CurrentUser` with `org_id` and `role`.
- `backend/auth.py` issues and validates JWTs using PyJWT with HS256 and a
  required `JWT_SECRET`, hashing passwords with passlib bcrypt.
- The Supabase client is nevertheless configured to persist sessions in
  `localStorage`. Whether any Supabase auth session is still established was not
  determined and needs a runtime check.

## 4. Backend

VERIFIED.

- FastAPI, entrypoint `backend/main.py`, with CORS configured for
  `localhost:8080`, `127.0.0.1:8080` and `localhost:5173`.
- Seven routers: `auth` (`/auth`), `domain`, `trips`, `machine_extras`, `ops`,
  `purchases`, `assistant` (`/assistant`). Only `auth` and `assistant` declare a
  path prefix; the rest mount at root.
- `backend/db.py` creates the SQLAlchemy engine from `DATABASE_URL` and raises
  at import time when it is absent.
- `backend/models.py` defines 37 mapped tables.
- Supporting modules: `analytics`, `recommendation_engine`, `product_matcher`,
  `ocr_utils`, `parse_receipt`, `receipt_ai`, `receipt_convert`,
  `import_planograms`, `init_db`, `seed_real_data`.
- LLM usage exists in `backend/assistant_routes.py` and `backend/receipt_ai.py`,
  via the `anthropic` and `google-genai` packages.

### 4.1 Backend runtime status

VERIFIED. The backend does not currently import in this environment:

```
python -c "import main"
ModuleNotFoundError: No module named 'sqlalchemy'
```

Missing from the active interpreter (Python 3.14.3): `sqlalchemy`, `alembic`,
`passlib`, `jwt`. Present: `fastapi`, `psycopg2`, `dotenv`, `pydantic`,
`uvicorn`. No virtualenv is committed or present in the repository.

### 4.2 Required environment variables

VERIFIED, extracted from tracked source. There is **no `backend/.env.example` on
main**, so none of these are documented in the repository:

`DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRE_HOURS`,
`DEFAULT_WAREHOUSE_ID`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `ZHIPU_API_KEY`,
`RECEIPT_AI_PROVIDER`, `RECEIPT_AI_MODEL`, `RECEIPT_AI_GEMINI_MODEL`,
`ASSISTANT_GEMINI_MODEL`

`backend/auth.py` and `backend/db.py` both raise at import time when their
variable is missing, so the application cannot start without them.

## 5. Databases and schema

VERIFIED. Three definitions of the schema exist, and none is designated
authoritative:

| Source | Tables | Role |
| --- | --- | --- |
| `backend/schema.sql` | 38 `CREATE TABLE` | Header claims it "replaces Supabase entirely" |
| `backend/models.py` | 37 `__tablename__` | SQLAlchemy ORM mapping used at runtime |
| `clouddata/migrations/*.sql` | 27 `CREATE TABLE` across 8 migrations | Supabase cloud schema, still referenced by the frontend |

The count mismatch between `schema.sql` and `models.py` was not reconciled
during this audit. Source-of-truth ambiguity is real and unresolved.

### 5.1 Migration tooling

VERIFIED. `alembic==1.13.3` is pinned in `requirements.txt`. There is no
`alembic.ini`, no `alembic/` directory, and no `versions/` directory anywhere in
the repository. Alembic is declared but never initialized. The only migration
files that exist are the eight Supabase SQL migrations under
`clouddata/migrations/`.

### 5.2 Committed database artifacts

VERIFIED. `localdb/SmartVendDatabase.backup` is a PostgreSQL custom-format dump,
91,761 bytes, committed to a public repository. Its contents were not inspected.

## 6. Integrations

| Integration | Status |
| --- | --- |
| Supabase | VERIFIED PRESENT. Client, 8 migrations, and a Deno edge function under `clouddata/functions/api/index.ts` that validates API keys and rate limits using `SUPABASE_SERVICE_ROLE_KEY`. Supabase project id `fxkiakkmzkxrpttgqpeh` is committed in `clouddata/config.toml`. |
| Anthropic Claude | VERIFIED PRESENT, backend receipt and assistant reasoning. |
| Google Gemini | VERIFIED PRESENT, backend receipt AI. |
| Zhipu GLM | PARTIALLY VERIFIED. `ZHIPU_API_KEY` is read; usage not traced. |
| VendSoft | NOT PRESENT on main. The VendSoft module exists only on `chore/preserve-vendsoft-wip`. |
| Cantaloupe / Seed Live | NOT PRESENT. No code, config, or reference. |
| Nayax | NOT PRESENT. |

## 7. Infrastructure and deployment

VERIFIED. No AWS SDK, no `boto3`, no `amazonaws` reference in tracked source.
No Dockerfile, no compose file, no `.github/` workflows, no deployment
manifests, no infrastructure-as-code. The only deployment-adjacent document is
`SETUP.md`, which describes local setup.

There is therefore no evidence in the repository for any environment
classification beyond local development.

## 8. Tests and validation

VERIFIED.

- Zero test files on main. No `pytest`, no Vitest, no Playwright, no test script.
- Toolchain results, executed during this audit after `npm ci` installed the 426
  declared packages:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS, exit 0 |
| `npm run build` | PASS, exit 0, built in 31s, main chunk 696 kB |
| `npm run lint` | FAIL, exit 1, 151 problems: 140 errors, 11 warnings |

Lint failures are dominated by `@typescript-eslint/no-explicit-any` plus one
`no-require-imports` in `tailwind.config.ts`. This is pre-existing debt, not a
regression introduced here.

`node_modules` was absent before this audit, so no frontend validation could
have been running for anyone in this state.

## 9. Security findings

Values were never printed, inspected, or tested during this audit.

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| S1 | Historical `.env` and `backend/.env` containing a real `DATABASE_URL` are reachable in **public** Git history at commit `4879cf5`, an ancestor of both `main` and `dev`. Deleted later, but history retains them. | Critical | `git merge-base --is-ancestor 4879cf5 origin/main` |
| S2 | `localdb/SmartVendDatabase.backup`, a PostgreSQL dump, is committed to a public repository. | High | Tracked file, 91,761 bytes |
| S3 | `backend/seed_data/` contains XLSX files whose names carry real customer and site names, for example school, hotel, and business locations. | High | 12 tracked planogram and seed files |
| S4 | `receiptsSample/` contains 17 real receipt images and PDFs in a public repository. | Medium | Tracked files, up to 571 kB |
| S5 | `data/vendsoft/raw/` and `data/vendsoft/reports/` were **not** ignored on main. 34 files of real extracted customer data sat untracked and one `git add -A` from being published. | High | Fixed on this branch by adding ignore rules |
| S6 | No `backend/.env.example`. Eleven required environment variables, including three third-party API keys and `JWT_SECRET`, are undocumented. | Medium | Section 4.2 |
| S7 | The Supabase edge function uses `SUPABASE_SERVICE_ROLE_KEY`, a full-privilege key, for API key validation and rate limiting. | Medium, unassessed | `clouddata/functions/api/index.ts` |
| S8 | The Supabase publishable key was historically exposed. Its real risk depends on whether Row Level Security is enabled, which was not verified. | Unassessed | Requires a Supabase console check |

S1 requires credential rotation. It is out of scope for this audit and requires
human action. No attempt was made to connect to any database or to rewrite
history.

## 10. Documentation state

CONTRADICTED. The repository documentation does not match the code.

- `README.md` line 52: "No Supabase, no Firebase, no other backend-as-a-service"
  and "deliberately migrated off Supabase early on". Line 275 repeats it.
- `SETUP.md` line 1: "SmartVend, Local Setup (Supabase removed)".
- `backend/schema.sql` line 2: "consolidated local schema (replaces Supabase
  entirely)".

All three are false as of `204a4bb`. Supabase remains the primary data path for
most domains. The README architecture diagram, showing React to FastAPI to
PostgreSQL as the only path, describes an intended end state, not the current
implementation.

No architecture decision records exist. No gameplan existed before this branch.

## 11. Prior assumptions tested

| Claim | Result | Evidence |
| --- | --- | --- |
| A. Two business-data paths, Supabase direct and FastAPI | **VERIFIED** | 11 Supabase hooks against 4 API hooks |
| B. Target is React to FastAPI to PostgreSQL | **ACCEPTED target, ADR-0001. NOT current state** | README diagram describes the target, not the implementation |
| C. Supabase should be consolidated behind FastAPI | **ACCEPTED as target, ADR-0001.** Not yet implemented | No consolidation work present in code |
| D. Local PostgreSQL is development, RDS is production | **Local PostgreSQL VERIFIED. RDS is an accepted target (ADR-0001), NOT current infrastructure** | No AWS reference anywhere in tracked content |
| E. Alembic expected but not properly initialized | **VERIFIED** | Pinned in requirements, zero config |
| F. VendSoft extraction code exists and is read-only | **CONTRADICTED for main** | Not on main; exists only on the preserved branch, where it is read-only |
| G. VendSoft raw and report outputs are ignored | **CONTRADICTED for main** | Not ignored on main; fixed on this branch |
| H. `productCode` is unsafe as a unique external key and a crosswalk is needed | **NOT VERIFIED here** | Requires VendSoft and Seed Live data evidence, not available on main |
| Supabase expected to have been removed | **CONTRADICTED** | Section 3.1 |

## 12. Key risks

1. **Dual write paths to two different databases.** Data written through
   Supabase and data written through FastAPI can diverge with no reconciliation.
   This is the primary architectural risk and it blocks a trustworthy canonical
   model.
2. **No tests and no CI.** Any change to either path is unverified. With two
   engineers working in parallel this compounds quickly.
3. **Schema ambiguity.** Three definitions, no designated authority, and no
   migration tooling in use means schema changes are manual and unrecorded.
4. **Customer data in a public repository.** Findings S2, S3, S4.
5. **Compromised credential in public history.** Finding S1.
6. **Documentation actively misleads.** An engineer or model trusting the README
   would design against a stack that does not exist.
7. **No environment separation.** Nothing distinguishes development from
   production, and no production infrastructure is described anywhere.

## 13. Immediate engineering decisions required

Already decided: **ADR-0001** consolidates business data behind FastAPI and
PostgreSQL and retires Supabase from business-data access. The Supabase usage
recorded throughout this document is therefore current-state technical debt with
a settled destination, not an open architectural question.

Still open. Each needs a human owner and an ADR.

1. Which schema definition becomes authoritative, and when is Alembic
   initialized against it?
2. What is the minimum test and CI baseline before further feature work?
3. What is the remediation plan for committed customer data and the exposed
   credential?
4. What is the target deployment environment, given no infrastructure exists?
5. Should the residual Supabase auth session configuration be removed, given
   authentication already runs through FastAPI? Authentication is evaluated
   independently of the data-path decision.

## 14. EVO installation status

VERIFIED. EVO v0.1.1 installed on this branch from local source commit
`6ac9f2d20f2cda8bf335d20031640cd6f6d9396a`.

- Profiles: `base`, `python`, `react-typescript`
- Manifest schema 1.1.0, hash algorithm `sha256-canonical-eol`, 49 EVO-owned
  files, integrity clean immediately after install with no false drift
- `evo doctor` reports PASS on every check except one WARN for validation
  commands, which this baseline configures
