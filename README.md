

# Smart Vend

Smart Vend is a full-stack vending management system that:

- Reads **purchase receipts (PDF/images)** using OCR  
- Automatically updates **warehouse inventory**  
- Provides **Smart Restock Recommendations** per machine  
- Computes **profit, cost, and revenue analytics**  
- Offers a modern **web dashboard** (React + shadcn)  

Tech stack:

- **Backend:** FastAPI, Python, SQLAlchemy, PostgreSQL, OCR (pytesseract, pdf2image, ocrmypdf)
- **Frontend:** React, Vite, TypeScript, shadcn/ui
- **Database:** PostgreSQL 18 (local), managed via pgAdmin 4

---

## 1. Prerequisites

Before running the project, install:

### 1.1 System Requirements

- **Windows 10/11**
- **Python** ≥ 3.10
- **Node.js** ≥ 18.x (with `npm`)
- **PostgreSQL 18** (with **pgAdmin 4**)


### 1.2 Python OCR Dependencies (System Level)

For best OCR performance:

- Install **Tesseract OCR** (Windows installer)
- Install **Poppler** or Ghostscript (for PDF to image conversion, if required by `pdf2image`)

> If OCR is already working on your machine, you don’t need to change anything.

---

 unzip the project into a folder, for example:

```text
C:\Users\you\Desktop\SmartVend
```

---

## 3. Execution Policy (PowerShell on Windows)

If you use **PowerShell**, you may see errors when activating the Python virtual environment.

Before running any backend setup commands in a new PowerShell window, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

This applies **only to the current PowerShell session** and allows scripts (like `activate.ps1`) to run.

---

## 4. PostgreSQL & Database Setup (Using pgAdmin 4)

This project expects a PostgreSQL database (for example, named `SmartVend`) restored from a backup file.

### 4.1 Install PostgreSQL and pgAdmin 4

1. Download and install **PostgreSQL** (v18) from the official website.
2. During installation, also install **pgAdmin 4**.
3. Remember your PostgreSQL **username** (commonly `postgres`) and **password**.

### 4.2  Create/Restore Database

> These steps assume you have a backup file like
> `database_backup.backup` in the project folder.

#### 4.2.1 Create an Empty Database

1. Open **pgAdmin 4**.
2. In the tree on the left, expand:

   * `Servers` → your PostgreSQL server → `Databases`.
3. Right-click **Databases** → **Create** → **Database…**
4. Fill in:

   * **Database name:** `SmartVend` (or any name, but match it in `.env`)
   * **Owner:** `postgres` (or your user)
5. Click **Save**.

You now have an **empty** database ready to restore into.

#### 4.2.2 Restore from Backup

1. In pgAdmin, right-click the new database (e.g. `SmartVend`) → **Restore…**
2. Set:

   * **Format:** `Custom`
   * **Filename:** browse to your project folder and select
     `C:\Users\you\Desktop\SmartVend\database_backup.backup`
3. Click **Restore** and wait until it says **"successful"** in the Messages tab.

Your local database is now populated with all the necessary tables and sample data.

#### 4.2.3 (Optional) How to Create Your Own Backup

If *you* want to create a backup to share with someone else:

1. Open **pgAdmin 4**.
2. In the tree:

   * `Servers` → PostgreSQL → `Databases`.
3. Right-click your DB (e.g. `SmartVend`) → **Backup…**
4. In the dialog:

   * **Format:** Custom
   * **Filename:** e.g.
     `C:\Users\you\Desktop\SmartVend\database_backup.backup`
5. Click **Backup** and wait until it shows **"successful"**.

---

## 5. Environment Variables (.env files)

The project uses `.env` files for configuration.

### 5.1 Backend `.env`

Inside the `backend` folder there should already be a `.env` file included in the project zip (or a template such as `.env.example` in an `env` or `config` folder).

If needed:

1. Copy the example:

   * e.g. copy `backend\.env.example` → `backend\.env`
2. Open `backend\.env` and confirm/edit values such as:

```env
DATABASE_URL=postgresql+psycopg2://postgres:<your_password>@localhost:5432/SmartVend
BACKEND_CORS_ORIGINS=["http://localhost:8080"]
```

Update:

* `postgres` → your actual DB user if different
* `<your_password>` → your actual PostgreSQL password
* `SmartVend` → your DB name if you used another name

### 5.2 Frontend `.env.local`

In the `frontend` folder, there may be a `.env.local` file already in the repo.

If not, create a new file:

`frontend/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

This tells the React app where the backend is running.

---

## 6. Backend Setup & Run (FastAPI)

### 6.1 Create and Activate Virtual Environment

From the **backend** folder:

```powershell
cd C:\Users\you\Desktop\SmartVend\backend

# (Recommended in PowerShell)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Create venv (only first time)
python -m venv .venv

# Activate venv
.\.venv\Scripts\activate
```

You should see `(.venv)` at the start of your prompt.

### 6.2 Install Python Dependencies

With the venv activated:

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

(If your project uses `pyproject.toml` or `Pipfile`, adjust accordingly.)

### 6.3 Run the Backend Server

Still inside the `backend` folder, with venv active:

```powershell
uvicorn main:app --reload --port 8000
```

You should see something like:

```text
Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

You can test:

* `http://127.0.0.1:8000/health` → should return a simple JSON OK response.

> ⚠ Leave this terminal **open** while you run the frontend.

---

## 7. Frontend Setup & Run (React + Vite)

Open a **new terminal** (separate from backend) and navigate to the frontend folder:

```powershell
cd C:\Users\you\Desktop\SmartVend\frontend
```

### 7.1 Install Node Dependencies

```powershell
npm install
```

This installs all required packages: React, Vite, shadcn/ui, Chart.js, etc.

### 7.2 Run the Frontend Dev Server

```powershell
npm run dev
```

You should see something like:

```text
VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:8080/
```

Now open the app in your browser:

 `http://localhost:8080/`

---

## 8. Running the Full System

To run the full Smart Vending Advisor:

1. **Start PostgreSQL** (the DB server must be running).

2. **Terminal 1 – Backend**

   ```powershell
   cd C:\Users\you\Desktop\SmartVend\backend
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\.venv\Scripts\activate
   uvicorn main:app --reload --port 8000
   ```

3. **Terminal 2 – Frontend**

   ```powershell
   cd C:\Users\you\Desktop\SmartVend\frontend
   npm install        # first time only
   npm run dev
   ```

4. Open browser at:
    `http://localhost:8080/`

---

## 9. Basic Usage Flow

Once the app is running:

1. **Sign up / log in** using the frontend.
2. Navigate to **Receipts** (`/app/receipts`).
3. Upload a **PDF or image** of a vending product receipt.
4. Wait for success message → the backend:

   * runs OCR
   * extracts items
   * updates `inventory_batches`.
5. Navigate to **Inventory** to see updated stock.
6. Navigate to **Smart Advisor** to see restock recommendations.
7. Navigate to **Reports → Profit Overview** to see revenue, cost, and profit.

---

## 10. Troubleshooting

### 10.1 Backend cannot connect to database

* Check `DATABASE_URL` in `backend/.env`
* Verify PostgreSQL is running.
* Confirm DB name, user, password in pgAdmin.

### 10.2 Frontend says “Failed to fetch”

* Make sure backend is running at `http://127.0.0.1:8000`
* Check `VITE_API_BASE_URL` in `frontend/.env.local`
* Refresh the browser.

### 10.3 OCR errors or 500 on upload

* Check terminal logs in backend window.
* Confirm Tesseract is installed and available in PATH.
* Check `uploads/` and `uploads_searchable/` folders for file output.

### 10.4 Execution policy error on Windows

If you see an error about running scripts:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then try activating the venv again.

---

