# SmartVend

A self-hosted, multi-tenant vending machine management platform — built as an
independent alternative to VendSoft, with a few things VendSoft doesn't do
(AI-read receipts, planned demand-driven routing, and a planned in-app AI
operations assistant).

This is a real, working full-stack application: a FastAPI/PostgreSQL backend
and a React/TypeScript frontend, with no dependency on Supabase or any
third-party backend-as-a-service. Everything — auth, multi-tenancy, business
logic — is our own code, running on our own database.

---

## What this project is

A route/machine owner (or their driver) can:
- Manage products, machines, locations, and coil-level planograms
- Assign restocking trips to drivers, who enter counts in the field and have
  warehouse inventory update automatically
- Upload a wholesale-club receipt (Costco, Sam's Club — image, PDF, or OXPS)
  and have an AI model read it, match products against the catalog, and
  update inventory, purchase history, and expenses automatically
- Track product expiration by batch, with early-warning surfacing
- Track mileage, expenses, service tickets, and see operational reports

It's multi-tenant from the ground up: each business (Organization) is fully
isolated from every other one, with a three-tier role hierarchy —
**Platform Admin -> Route/Machine Owner -> Driver** — each with different
permissions, verified with real cross-tenant isolation tests (see below).

---

## Architecture

```
+----------------------+         +------------------------+        +-----------------+
|  React + TypeScript  |  HTTPS  |   FastAPI (Python)      |  SQL   |   PostgreSQL    |
|  Vite, Tailwind,      | ------> |   JWT auth, REST API    | -----> |   (own schema,  |
|  shadcn/ui, React     | <------ |   SQLAlchemy ORM        | <----- |   no Supabase)  |
|  Query                |         |                          |        |                 |
+-----------------------+         +------------+-------------+        +-----------------+
                                              |
                                              v
                                  +-------------------------+
                                  |  Anthropic Claude API    |  (receipt reasoning,
                                  |  Zhipu GLM-OCR API       |   planned assistant)
                                  |  (both external, optional)|
                                  +-------------------------+
```

No Supabase, no Firebase, no other backend-as-a-service — this was
deliberately migrated off Supabase early on so the whole stack is
self-hostable and inspectable.

---

## What's implemented

Everything below has been built **and tested against a live database** —
either with real HTTP requests via a test client, or clicked through in an
actual headless browser session (Playwright), not just read for correctness.
Real business data (178 real products, 12 real machines with real planogram
data, real Costco/Sam's Club receipts) was used throughout testing, not
placeholder data.

### Core platform
- **Auth & multi-tenancy**: JWT-based auth, three-tier roles (Platform Admin
  -> Route Owner -> Driver), full tenant data isolation verified with a
  second test organization that correctly sees zero of another org's data
- **Products & Inventory**: full CRUD, warehouse stock tracking, VendSoft-
  parity fields (units per case, reorder point, order-up-to level)
- **Machines**: full detail page with General/Planogram tabs and a working
  Actions panel — Edit, Maintenance (creates a real ticket), Service History,
  Predictions, Upload Photo, Add Attachment, Commission, **Generate QR Code**
  (real scannable, downloadable QR), Delete
- **Locations**: full detail page with Address/Config/Machines/Map tabs,
  working-days picker, commission configuration
- **Coils / Planogram**: per-coil product assignment, per-location price
  overrides, DEX-price-vs-configured-price mismatch flagging
- **Trips & restocking**: owner assigns a trip (driver + machine list); driver
  sees it grouped Location -> Machines -> Coils exactly like VendSoft's "Enter
  Trip Results" flow; submitting a coil's count automatically decrements
  warehouse stock and writes a paired inventory ledger entry
- **Real planogram data imported**: all 12 of the user's real machines, 430
  real coils, matched to the real 178-product catalog by exact name

### Purchases / Receipts (AI-powered)
This replaced an earlier `pytesseract` + regex pipeline that turned out to be
non-functional after multi-tenancy was added (it created products without an
`org_id`, which the schema requires).

- **Any file format**: image, PDF, OXPS/XPS (Microsoft's print-to-file
  format), DOC/DOCX — all converted to images via PyMuPDF/LibreOffice and
  verified against all of the user's real files, including 7 real `.oxps`
  receipts and several photographed Costco/Sam's Club thermal receipts
- **Two-stage, swappable AI pipeline**:
  1. Vision extraction — reads the receipt image
  2. Reasoning — matches abbreviated wholesale-club product names ("FARLF NP
     CHF") against the real catalog using context, not string similarity
  - Provider is configurable: `gemini_vision` (default — **free**, no credit
    card, via Google AI Studio), `claude_vision` (single-pass, needs a paid
    Anthropic key), or `glm_ocr` (Zhipu GLM-OCR for extraction + Claude for
    reasoning, needs both keys)
- **Document classification**: the AI first decides whether an upload is an
  **inventory purchase** (products to stock) or an **expense** (fuel,
  vehicle repair, a replacement card reader, equipment, supplies) —
  confirmed live with a real test: a mocked "Shell Gas Station, $62.40,
  Fuel" upload correctly skipped all product matching and landed straight
  in Expenses with the right category, vendor, and even auto-attached the
  receipt image as proof
- **Web-search-assisted pack-size lookup**: when a receipt doesn't state a
  case-pack size (common on Costco receipts) and there's no remembered
  value for that product+supplier yet, Gemini can use Google Search
  grounding to look up the real pack size before falling back to asking —
  scoped to only the lines that actually need it, not every call
- **Per-supplier pack-size memory, confirmed working as designed**: once a
  product+supplier's case size is confirmed once, every future receipt from
  that same supplier auto-fills it — a different supplier for the same
  product still asks once, since real-world pack sizes genuinely differ
  between wholesalers
- **Voice fill**: record once, say a product name, its expiration date, and
  units-per-case if missing — say "next" or "skip" to move through the
  list. Built on `MediaRecorder` (works in every modern browser, not just
  Chrome) sending the actual audio to Gemini for transcription and
  interpretation together, with a visible transcript so you can catch a
  misheard word immediately. Verified: fed a mocked transcript referencing
  a real product name and confirmed it mapped to the exact right database
  row, not a guess. Manual typing/editing remains fully available alongside
  it, unchanged
- **Shelf location per batch**: an optional free-text field (left empty by
  default, route owner fills in whatever labeling makes sense for their own
  warehouse) carried from the receipt review screen onto the actual
  inventory batch, so "expiring soon" isn't just a number — it's a specific
  batch you can walk up to
- **Review-before-commit workflow**: nothing writes to inventory silently.
  Every upload produces an editable proposal — matched product, quantity,
  case-pack size, price, expiry, shelf location — before confirming
- **Case-pack quantity handling**: a receipt says "24 pk, qty 2" -> warehouse
  increases by 48 individual units, not 2
- **Safeguards, verified with real tests**: confirming is blocked if any
  product line has no price, or isn't matched to a product; VOID and
  discount/instant-savings lines are correctly excluded from inventory
- **Confirmed purchases automatically**: update warehouse stock, update
  product cost/last-supplier, create a dated inventory batch (with
  expiration date and shelf location), and create a matching Expense entry
  so purchase costs flow into the daily expense/profit picture
- **Manual expense entry** with an optional proof photo (handwritten note,
  informal receipt) — never required to save the entry, purely for your own
  records
- **Profit by date range**: pick a window, see revenue minus every real
  expense in it (inventory purchases included, since those land in Expenses
  automatically), with a category breakdown — verified live with real dates:
  correctly summed a $245 repair + $62.40 fuel expense only when the range
  included them, correctly returned all zeros for an out-of-range window
- **Expiration tracking**: per-batch expiry dates, a `/inventory/expiring-
  soon` endpoint, and a warning banner on the Products page — confirmed
  working live: added a batch expiring in 6 days, watched the banner appear,
  confirmed the 14-day/30-day window logic is exact
- **Margin by Product report**: for every product, shows the receipt-derived
  cost against *every* price it's actually configured to sell for across
  different locations (prices genuinely vary by coil), with per-unit margin
  at each. Verified against real data — e.g. Coke (Bottle) costs $0.69 and
  sells for $1.03–$2.75 depending on location, margins 33%–75%. Deliberately
  labeled as **potential margin per unit**, not realized profit — actual
  gross income needs real sold-unit counts, which the system doesn't track
  yet (see the gap below)

### Operations
- Tickets (maintenance/service history), Mileage Log, Expenses, Routes list,
  Calendar (trips by day), Reports (P&L, operational stats — honest about
  showing $0 revenue until real sales/vend data exists), Team management,
  Configuration (org settings), Profile
- **Margin by Product report**: real cost (from confirmed receipts) against
  every price a product is actually configured to sell for across different
  locations, with per-unit margin at each — verified with real data (e.g.
  Coke (Bottle): $0.69 cost, sells $1.03–$2.75 depending on location, 33%–75%
  margin). Labeled honestly as potential margin per unit, not realized
  profit — that still needs real sold-unit data
- TopBar Quick Actions and Profile/Settings menus — were dead links in an
  earlier pass, now genuinely wired up; notifications show real low-stock
  and completed-trip data instead of placeholder content

### Feature  — customizable dashboard + AI assistant
- **Customizable dashboard**: 10 real widgets (stats, low stock, active
  trips, top products by margin, expiring soon, margin snapshot, recent
  tickets, team, recent trips, expenses summary) that any route owner can
  toggle on/off and reorder. Layout is saved per-user in the database and
  verified to persist across a full page reload, not just in local state
- **AI assistant chat bar**, embedded directly in the dashboard (not a
  separate page), built on Gemini's tool-calling: it can look up real data
  (low stock, expiring batches, pending purchases, open tickets, margins)
  and navigate the user to any page on request. It has exactly one tool that
  changes data (`confirm_purchase`) — that tool is **never auto-executed**;
  the model can only propose it, and the backend forces a separate explicit
  user click before anything actually runs. The underlying `confirm_purchase`
  logic was refactored into one shared function used identically by both the
  REST endpoint and the assistant, so there's exactly one implementation to
  trust — verified via direct test to produce the exact same result as the
  REST endpoint (stock +28 units, matching case-pack math)
- Every read-only tool was tested directly against real business data and
  returns correct real numbers. The full live conversation loop against
  Gemini's API is implemented per their documented function-calling protocol
  but **not live-tested** — no API key or network access to
  `generativelanguage.googleapis.com` from this development environment.
  Verified instead: the endpoint gives a clean, readable error (not a crash)
  when the key is missing, confirmed live in the browser with the actual
  chat UI

---



## Future plans

**Near-term:**
- Wire the receipts pipeline and the assistant to a real `GEMINI_API_KEY`
  and validate quality against the full real receipt set and real questions
- Expand the assistant's tool set as more write-actions are wanted (each new
  one follows the same confirm-before-write pattern as `confirm_purchase`)
- Build a real sales/vend data model so Reports and profit tracking become
  fully real, and so the (currently dead) restock-recommendation engine can
  be rebuilt against real sales velocity

**Once SeedLive/Cantaloupe API access is available:**
- Pull real transaction/sales data per machine
- Build demand-driven route suggestions (feature 2) and coil-swap
  recommendations (feature 3) from that real sales history

**Infrastructure:**
- Frontend -> Vercel (free tier is a good fit for a static React build)
- Backend -> a persistently-running host (AWS Fargate/Lightsail, or Railway/
  Render) — **not** Vercel serverless functions, which don't suit this
  backend's local file storage, long AI calls, and persistent DB connections
- Database -> AWS RDS Postgres
- AI models -> AWS Bedrock (same per-token price as calling Anthropic
  directly, no markup) or direct Anthropic/Zhipu APIs

---

## Getting started

See **[SETUP.md](./SETUP.md)** for full local setup instructions — creating
the database, configuring environment variables, seeding real data, running
both the backend and frontend.

Quick version:
```bash
# Backend
cd backend
pip install -r ../requirements.txt --break-system-packages
python init_db.py
python seed_real_data.py
python import_planograms.py
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
npm install
npm run dev
```

Default logins after seeding — see SETUP.md for the full table.

---

## Tech stack

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React
Query, React Router

**Backend**: FastAPI, SQLAlchemy, PostgreSQL, JWT auth (python-jose/passlib),
PyMuPDF (document conversion), Google Gemini API (free tier, default receipts
provider), Anthropic SDK, Zhipu GLM-OCR (both optional alternate providers)

**No Supabase, no Firebase** — self-hosted from the database up.
