# SmartVend — Local Setup (Supabase removed)

This replaces the old Supabase setup entirely. Everything now runs against your
own local PostgreSQL, with your own JWT auth.

---

## 1. Prerequisites

- PostgreSQL 14+ (16 recommended)
- Python 3.10+
- Node.js 18+

---

## 2. Create the database

Using pgAdmin or psql, create an empty database:

```sql
CREATE DATABASE vendsmart_local;
```

---

## 3. Configure `backend/.env`

```env
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/vendsmart_local

# Generate your own with:
#   python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=replace-me-with-a-random-64-char-hex-string
ACCESS_TOKEN_EXPIRE_HOURS=12

# Receipts / Purchases AI pipeline (see README for the full explanation)
# "gemini_vision" (default, recommended) — FREE, no credit card needed.
#   Get a key at https://aistudio.google.com — takes about a minute.
# "claude_vision" — needs a paid ANTHROPIC_API_KEY.
# "glm_ocr" — needs both ZHIPU_API_KEY and ANTHROPIC_API_KEY (OCR + reasoning stages).
RECEIPT_AI_PROVIDER=gemini_vision
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
ZHIPU_API_KEY=
```

> **On the free Gemini tier:** it's genuinely free and needs no credit card, but
> it's rate-limited (~1,500 requests/day — far more than you'll use) and Google's
> free-tier terms may use your prompts to improve their models unless you opt out
> in Google AI Studio's settings. Fine for getting this running; worth checking
> that setting before uploading real supplier pricing you consider sensitive.

> **Important:** change `JWT_SECRET` before deploying anywhere. Anyone who knows
> it can forge login tokens for any account.
> The Purchases/Receipts feature (upload a receipt → auto-read → update inventory)
> won't work until `ANTHROPIC_API_KEY` (and optionally `ZHIPU_API_KEY`) is set —
> everything else in the app works without it.

---

## 4. Install Python dependencies

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r ../requirements.txt
```

---

## 5. Create the schema

```bash
cd backend
python init_db.py
```

Run this **once** against an empty database. It creates all tables, enums,
indexes, and triggers from `schema.sql`.

---

## 6. Seed your real data

```bash
cd backend
python seed_real_data.py
python import_planograms.py
```

`seed_real_data.py` creates the admin/owner accounts and imports:
- **12 locations**
- **12 machines** (with telemetry IDs and column counts)
- **178 products**

`import_planograms.py` then imports the real per-machine coil/planogram data
from `backend/seed_data/planograms/` — matches each Excel file to its machine
by name, matches each coil's product by exact name, and creates one `slots`
row per coil (430 coils total across the 12 machines). Every product name in
the planograms matched the catalog exactly, so no coils are left unassigned.

To override any of the defaults:

```bash
python seed_real_data.py --admin-email you@example.com --admin-password "StrongPass1" \
                         --org-name "Your Company" \
                         --owner-email owner@example.com --owner-password "StrongPass2"
```

The script is safe to re-run — it skips records that already exist.

### Data-quality notes from the import

These are flagged rather than silently "fixed", so you can correct them in the app:

- **62 of 178 products have no cost** in the source export → imported at `$0.00`.
- **No sell prices exist in the export at all** → auto-set to `cost x 1.5` as a
  placeholder. Set real prices before going live.
- **Duplicate product codes**: Code `90` and Code `169` are each used for two
  different products. Both were kept, with the second given a `-DUP2` suffix.
- **Negative warehouse stock** on several products (pre-existing inventory drift
  in the source data) — imported as-is rather than zeroed.

---

## 7. Run the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Interactive API docs: <http://127.0.0.1:8000/docs>

---

## 8. Run the frontend

```bash
npm install
npm run dev
```

Then open <http://localhost:8080>.

`.env.local` must contain:
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## What's clickable right now

Log in as the Route Owner (`investments.lmf@gmail.com` / `test123`) and you can:
1. Browse **Products**, **Machines**, **Locations** — all your real data
2. Open a machine's **Coils** tab and assign products / set per-location prices
3. Go to **Team** and create a driver login
4. Go to **Trips**, click **Assign Trip**, pick the driver and machines
5. Log out, log back in as the driver you created — you'll land on `/app/driver`
6. Click **Enter Trip Results** → pick a machine → enter counts → **Save & Complete Machine**
7. Once every machine on the trip is done, **Complete Trip** unlocks



## Role hierarchy

```
Platform Admin  (you — one global account, no organization)
      │  creates organizations + their owners
      ▼
Route/Machine Owner  (one per business/tenant — sees only their own data)
      │  creates drivers, machines, locations, products, trips
      ▼
Driver  (restricted — sees only their assigned trips, enters restock counts)
```

- The **first account** is created via `/signup` (or the seed script) and becomes
  the Platform Admin. That page refuses to run a second time.
- There is **no open self-signup** — every other account is created from inside
  the app by someone above them in the hierarchy.
- Each organization's data is isolated at the database level via `org_id`;
  one owner cannot see another owner's machines, products, or trips.

---

## The restocking workflow (mirrors VendSoft)

1. **Owner creates a trip** — `POST /trips` with a driver and an ordered list of machines.
2. **Driver opens the trip** — `GET /trips/{id}` returns it grouped by
   **Location → Machines → Coils**, with each coil's product, price, capacity,
   par level, and current quantity.
3. **Driver enters results** — `POST /route-stops/{id}/restock` submits per-coil
   `current_count` and `filled_qty`. In the same call the driver can **reassign a
   coil's product** and **override the price** at that location.
4. **On submit**, the system automatically:
   - updates each coil's quantity,
   - decrements warehouse stock for what was loaded,
   - writes paired `inventory_ledger` rows (warehouse `-N`, machine `+N`),
   - marks that machine's stop complete.
5. **Complete the trip** — `PATCH /trips/{id}/complete`. This refuses to run
   while any machine on the trip still has unsubmitted results.

---

## API summary

**Auth**
```
POST   /auth/bootstrap-admin        one-time platform admin creation
POST   /auth/login
GET    /auth/me
POST   /auth/organizations          admin: onboard a business + its owner
POST   /auth/users                  owner: create a driver
GET    /auth/users
PATCH  /auth/users/{id}/deactivate
```

**Products / Locations / Machines** (owner writes, driver reads)
```
GET|POST            /products    /locations    /machines
GET|PATCH|DELETE    /products/{id}    /locations/{id}    /machines/{id}
```

**Coils & Trips**
```
GET    /machines/{id}/slots
POST   /machines/{id}/slots              owner only
PATCH  /slots/{id}                       owner, or driver on an active trip
POST   /trips                            owner only
GET    /trips                            drivers see only their own
GET    /trips/{id}                       full Location→Machine→Coil view
PATCH  /trips/{id}/start
POST   /route-stops/{id}/restock         the "Enter Trip Results" action
PATCH  /trips/{id}/complete
```

**Existing features (unchanged)**
```
POST   /api/receipts/upload              receipt OCR
GET    /api/recommendations/restock      smart advisor
GET    /api/analytics/profit/summary     profit tracking
GET    /api/analytics/profit/by-machine
GET    /api/inventory/warehouse
```

---

## Current status

See the main README.md for the full picture of what's built, what's tested,
and what's planned next. This file stays focused on *how to run it*.

## API summary (Purchases / Receipts)

```
POST   /purchases/upload                 upload a receipt (any format), AI reads it
GET    /purchases                        list purchases (filter ?status=)
GET    /purchases/{id}                   full detail with line items
PATCH  /purchases/{id}/lines/{line_id}   edit a line during review
DELETE /purchases/{id}/lines/{line_id}   remove a bad line
POST   /purchases/{id}/confirm           commit: updates inventory + creates an Expense
POST   /purchases/{id}/reject            discard without touching inventory
GET    /products/{id}/batches            expiration-dated inventory batches for a product
GET    /inventory/expiring-soon?days=14  batches expiring soon, org-wide
GET    /reports/margin-by-product        cost (from receipts) vs. every configured
                                          sell price, per unit margin at each
```

## API summary (Dashboard / Assistant — feature 7)

```
GET    /dashboard/layout          get this user's saved widget layout
PATCH  /dashboard/layout          save widget selection + order
POST   /assistant/chat            chat with the assistant (tool-calling loop)
POST   /assistant/execute-action  run a write action the assistant proposed,
                                   only after the user clicks Confirm
```
