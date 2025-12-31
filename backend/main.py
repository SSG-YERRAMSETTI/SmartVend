from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from uuid import uuid4
import os
from decimal import Decimal
from uuid import UUID
from sqlalchemy import func
from pydantic import BaseModel
from typing import List
from analytics import get_profit_summary, get_profit_by_machine



from fastapi import APIRouter
from recommendation_engine import compute_restock_recommendations






from db import SessionLocal
from models import Receipt, ReceiptLine, Product, InventoryBatch
from ocr_utils import extract_text_any
from parse_receipt import parse_vendor, parse_date, parse_lines
from product_matcher import find_or_create_product

load_dotenv()

app = FastAPI()


class WarehouseInventoryItem(BaseModel):
    product_id: UUID
    name: str
    sku: str | None = None
    quantity: int
    avg_unit_cost: float


origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
        # keep these too in case you ever change ports back
    "http://localhost:5173",
    "http://127.0.0.1:5173",

]




app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
SEARCHABLE_DIR = Path("uploads_searchable")

DEFAULT_WAREHOUSE_ID = os.getenv("DEFAULT_WAREHOUSE_ID")

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/analytics/profit/summary")
def profit_summary():
    """
    Overall profit analytics.
    """
    return get_profit_summary()


@app.get("/api/analytics/profit/by-machine")
def profit_by_machine():
    """
    Profit breakdown per machine.
    """
    return get_profit_by_machine()


@app.get("/api/recommendations/restock")
def get_restock_recommendations():
    return compute_restock_recommendations()

@app.get("/api/inventory/warehouse", response_model=List[WarehouseInventoryItem])
def get_warehouse_inventory():
    if not DEFAULT_WAREHOUSE_ID:
        raise HTTPException(status_code=500, detail="DEFAULT_WAREHOUSE_ID not set")

    session: Session = SessionLocal()

    try:
        rows = (
            session.query(
                Product.id.label("product_id"),
                Product.name.label("name"),
                Product.sku.label("sku"),
                func.coalesce(func.sum(InventoryBatch.quantity), 0).label("quantity"),
                func.coalesce(func.avg(InventoryBatch.unit_cost), 0).label("avg_unit_cost"),
            )
            .join(InventoryBatch, InventoryBatch.product_id == Product.id)
            .filter(
                InventoryBatch.location_type == "warehouse",
                InventoryBatch.location_id == UUID(DEFAULT_WAREHOUSE_ID),
            )
            .group_by(Product.id, Product.name, Product.sku)
            .order_by(Product.name)
            .all()
        )

        return [
            WarehouseInventoryItem(
                product_id=row.product_id,
                name=row.name,
                sku=row.sku,
                quantity=int(row.quantity or 0),
                avg_unit_cost=float(row.avg_unit_cost or 0.0),
            )
            for row in rows
        ]
    finally:
        session.close()




@app.post("/api/receipts/upload")
async def upload_receipt(file: UploadFile = File(...)):
    if not DEFAULT_WAREHOUSE_ID:
        raise HTTPException(status_code=500, detail="DEFAULT_WAREHOUSE_ID not set in backend/.env")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    SEARCHABLE_DIR.mkdir(parents=True, exist_ok=True)

    # 1) Save uploaded file
    dest_path = UPLOAD_DIR / file.filename
    with open(dest_path, "wb") as f:
        f.write(await file.read())

    # 2) OCR / extract text
    text = extract_text_any(dest_path, SEARCHABLE_DIR)

    # DEBUG: save raw OCR text so we can inspect
    DEBUG_DIR = Path("debug_receipts")
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    (debug_path := DEBUG_DIR / f"{file.filename}.txt").write_text(text, encoding="utf-8", errors="ignore")
    print(f"[DEBUG] OCR text saved to {debug_path}")


    vendor = parse_vendor(text)
    rdate = parse_date(text)
    lines = parse_lines(text)

    if not lines:
        raise HTTPException(status_code=400, detail="Could not parse any line items from receipt")

    from sqlalchemy.orm import Session
    session: Session = SessionLocal()

    try:
        # 3) Insert main receipt row
        rec = Receipt(
            vendor_name=vendor,
            receipt_date=rdate,
            raw_text=text,
            filename=file.filename,
            source=file.content_type or "upload",
        )
        session.add(rec)
        session.flush()  # get rec.id

        inventory_batches_created = []

        for line in lines:
            product_raw = line["product_raw"]
            qty = int(line["quantity"])
            unit_cost = Decimal(str(line["unit_cost"]))
            total_cost = Decimal(str(line["total_cost"]))

            # 4) Find or create Product
            product: Product = find_or_create_product(session, product_raw, float(unit_cost))

            # 5) Insert receipt line
            rl = ReceiptLine(
                receipt_id=rec.id,
                product_raw=product_raw,
                product_id=product.id,
                quantity=qty,
                unit_cost=unit_cost,
                total_cost=total_cost,
            )
            session.add(rl)

            # 6) Insert inventory batch at warehouse
            batch = InventoryBatch(
                product_id=product.id,
                location_type="warehouse",
                location_id=DEFAULT_WAREHOUSE_ID,
                batch_number=str(uuid4()),
                quantity=qty,
                unit_cost=unit_cost,
            )
            session.add(batch)

            # 7) Update product.warehouse_stock
            product.warehouse_stock = (product.warehouse_stock or 0) + qty

            inventory_batches_created.append({
                "product_name": product.name,
                "quantity": qty,
                "unit_cost": float(unit_cost),
            })

        session.commit()

        return {
            "message": "receipt processed",
            "receipt_id": str(rec.id),
            "vendor": vendor,
            "date": rdate.isoformat() if rdate else None,
            "lines_parsed": len(lines),
            "batches_created": inventory_batches_created,
        }

    except Exception as e:
        session.rollback()
        print("ERROR processing receipt:", e)
        raise HTTPException(status_code=500, detail="Failed to process receipt")
    finally:
        session.close()


