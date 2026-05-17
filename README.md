<div align="center">

# SmartVend

**A full-stack vending machine management platform with AI-powered restocking and OCR receipt processing**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-316192?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)

</div>

---

> Vending operators spend a surprising amount of time on things that shouldn't require their time — manually counting stock, guessing when to restock, and reconciling receipts by hand. SmartVend automates all of it.

SmartVend is a complete vending business management platform. Upload a purchase receipt (image or PDF) and the system reads it with OCR, updates your warehouse inventory automatically, tells you which machines need restocking before they run out, and gives you a real profit view based on actual costs — not estimates.

---

## What It Does

**Receipt Processing (OCR Pipeline)**
Upload a photo or PDF of any supplier receipt and SmartVend extracts the line items, quantities, and unit costs automatically. The backend runs Tesseract OCR with pdf2image for dual-format support, parses the extracted text into structured data, and updates inventory batches in PostgreSQL. No manual entry.

**Smart Restock Recommendations**
The recommendation engine calculates a rolling 7-day sales velocity per product per machine, forecasts demand for the next 3 days, and flags anything where current stock falls short of that forecast. Each recommendation comes with a plain-English explanation of exactly why it's flagging that item.

**Profit and Revenue Analytics**
Revenue is calculated from actual sales data. Cost is pulled from real receipt line items — not from catalog prices. The result is a profit view that reflects what you actually paid for inventory, not what the system thought you paid.

**Operations Dashboard**
Route optimisation for drivers, barcode scanning for field stock checks, planogram editor for machine layout, commission statement generation for location partners, and a full telemetry layer with configurable alert rules.

**Role-Based Access**
Three distinct roles — admin, driver, and location partner — each with their own view and permissions. Admins manage everything. Drivers see their route and pick list. Location partners get a read-only portal showing their machine performance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│           (Vite · TypeScript · shadcn/ui · Recharts)        │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             ▼                            ▼
    ┌─────────────────┐         ┌──────────────────────┐
    │    Supabase      │         │   FastAPI Backend     │
    │  (Auth + Main    │         │  (OCR · Analytics ·  │
    │   App Database)  │         │   Recommendations)   │
    └─────────────────┘         └──────────┬───────────┘
                                           │
                                  ┌────────▼────────┐
                                  │   PostgreSQL     │
                                  │  (Receipts ·     │
                                  │  Inventory ·     │
                                  │  Sales Data)     │
                                  └─────────────────┘
```

The frontend talks to two backends. Supabase handles authentication and the main application data (machines, locations, routes, users). The FastAPI backend handles the compute-heavy tasks — OCR processing, demand forecasting, profit analytics — and keeps receipt and inventory batch data in a local PostgreSQL instance.

---

## Tech Stack

**Frontend**
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| UI components | shadcn/ui + Radix UI |
| Charts | Recharts + Chart.js |
| Auth + Cloud DB | Supabase |
| State management | TanStack Query |
| Forms | React Hook Form + Zod |
| Offline sync | IndexedDB (idb) |

**Backend**
| Layer | Technology |
|-------|-----------|
| API framework | FastAPI |
| Database ORM | SQLAlchemy + Alembic |
| Database | PostgreSQL 18 |
| OCR | pytesseract + pdf2image + ocrmypdf |
| Image handling | Pillow |

---

## Project Structure

```
smartvend/
│
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── dashboard/            # Dashboard widgets + sparklines
│   │   ├── driver/               # Barcode scanner, photo capture, checklists
│   │   ├── inventory/            # CSV import, product dialogs, transfers
│   │   ├── machines/             # Machine cards, planogram editor
│   │   ├── routes/               # Route optimizer, pick list view
│   │   ├── sales/                # Cash collection, settlement, tax summary
│   │   └── telemetry/            # Alert rules, notification center
│   ├── pages/app/                # App pages (one per route)
│   ├── hooks/                    # Custom React hooks
│   └── integrations/supabase/    # Supabase client + types
│
├── backend/                      # FastAPI backend
│   ├── main.py                   # API routes
│   ├── models.py                 # SQLAlchemy models
│   ├── analytics.py              # Profit calculation queries
│   ├── recommendation_engine.py  # Restock forecasting
│   ├── ocr_utils.py              # OCR extraction (image + PDF)
│   ├── parse_receipt.py          # Receipt text parser
│   ├── product_matcher.py        # Product lookup + creation
│   └── db.py                     # Database session
│
├── clouddata/
│   ├── migrations/               # Supabase SQL migrations
│   └── functions/api/            # Edge functions
│
├── receiptsSample/               # Sample receipts for testing
├── requirements.txt              # Python dependencies
└── package.json                  # Node dependencies
```

---

## Getting Started

### Prerequisites

Make sure you have these installed before you start:

- **Python** 3.10 or higher
- **Node.js** 18.x or higher (with npm)
- **PostgreSQL 18** (with pgAdmin 4)
- **Tesseract OCR** — [Windows installer](https://github.com/UB-Mannheim/tesseract/wiki) · [Mac: `brew install tesseract`]
- **Poppler** (for PDF handling) — [Windows](https://github.com/oschwartz10612/poppler-windows/releases) · [Mac: `brew install poppler`]
- A **Supabase project** (free tier works) for auth and main database

---

### 1. Clone the Repository

```bash
git clone https://github.com/SSG-YERRAMSETTI/smartvend.git
cd smartvend
```

---

### 2. Database Setup (PostgreSQL)

**Create the database:**
1. Open pgAdmin 4
2. Right-click **Databases** → **Create** → **Database**
3. Name it `SmartVend` → click **Save**

**Restore from the backup:**
1. Right-click the new database → **Restore**
2. Format: `Custom` · Filename: browse to `localdb/SmartVendDatabase.backup`
3. Click **Restore** and wait for "successful"

---

### 3. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\activate

# Mac / Linux
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

**Configure environment variables:**

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/SmartVend
DEFAULT_WAREHOUSE_ID=your-warehouse-uuid-here
BACKEND_CORS_ORIGINS=["http://localhost:8080"]
```

**Start the backend:**

```bash
uvicorn main:app --reload --port 8000
```

Verify it's running: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) should return `{"status": "ok"}`.

---

### 4. Frontend Setup

Open a **new terminal** (keep the backend terminal running):

```bash
# From the project root
npm install
```

**Configure environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Start the frontend:**

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

### 5. Running the Full System

You need three things running at the same time:

| What | Command | Terminal |
|------|---------|---------|
| PostgreSQL | Start from pgAdmin or as a service | — |
| FastAPI backend | `uvicorn main:app --reload --port 8000` (from `backend/`) | Terminal 1 |
| React frontend | `npm run dev` (from project root) | Terminal 2 |

---

## Usage Flow

Once everything is running:

1. **Sign up** at [localhost:8080](http://localhost:8080) to create your account
2. Go to **Machines** → add your vending machines and their locations
3. Go to **Inventory** → set up your products and warehouse stock
4. Go to **Receipts** → upload a supplier receipt (image or PDF)
   - The system OCRs the file, extracts line items, and updates warehouse inventory automatically
5. Go to **Smart Advisor** → view restock recommendations per machine
6. Go to **Reports** → see revenue, cost, and profit analytics
7. Go to **Routes** → plan driver routes and generate pick lists

---

## API Reference

The FastAPI backend exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/receipts/upload` | Upload and process a receipt |
| `GET` | `/api/inventory/warehouse` | Get warehouse inventory |
| `GET` | `/api/recommendations/restock` | Get restock recommendations |
| `GET` | `/api/analytics/profit/summary` | Overall profit summary |
| `GET` | `/api/analytics/profit/by-machine` | Profit breakdown per machine |

Interactive docs available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) when the backend is running.

---

## Troubleshooting

**Backend can't connect to database**
Check `DATABASE_URL` in `backend/.env`. Confirm PostgreSQL is running and the DB name matches exactly.

**"Failed to fetch" in frontend**
Make sure the backend is running at port 8000. Check `VITE_API_BASE_URL` in `.env.local`. Try a hard refresh.

**OCR errors or 500 on receipt upload**
Confirm Tesseract is installed and available in your system PATH. Check the `backend/debug_receipts/` folder — the raw OCR text is saved there after each upload, which makes it easy to see what the parser is working with.

**PowerShell execution policy error (Windows)**
Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` before activating the virtual environment.

---

## Author

**Satya Sai Ganesh Yerramsetti**
MS Computer Science — University of North Texas

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=flat-square&logo=linkedin)](https://linkedin.com/in/satya-sai-ganesh-yerramsetti-2a204424b)
[![GitHub](https://img.shields.io/badge/GitHub-SSG--YERRAMSETTI-181717?style=flat-square&logo=github)](https://github.com/SSG-YERRAMSETTI)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?style=flat-square&logo=gmail)](mailto:satyasaiganeshyerramsetti@my.unt.edu)

---

<div align="center">
  <sub>If this was useful, a ⭐ helps.</sub>
</div>
