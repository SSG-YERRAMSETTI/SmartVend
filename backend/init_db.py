"""
One-time setup script: creates every table, enum, and trigger defined in schema.sql
against whatever database DATABASE_URL (in backend/.env) points to.

Run this ONCE against a fresh, empty database:
    cd backend
    python init_db.py

Safe to re-run only against an empty DB — it will error on tables/types that
already exist (that's intentional, to avoid silently clobbering real data).
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in backend/.env")

# psycopg2 wants a plain postgresql:// URL, not the SQLAlchemy postgresql+psycopg2:// form
raw_url = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")

schema_path = Path(__file__).parent / "schema.sql"
sql = schema_path.read_text()

print(f"Connecting to database...")
conn = psycopg2.connect(raw_url)
conn.autocommit = True
cur = conn.cursor()

print("Running schema.sql (creating extensions, enums, tables, triggers)...")
cur.execute(sql)

print("Done. Schema created successfully.")
cur.close()
conn.close()
