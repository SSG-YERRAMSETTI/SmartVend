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
from models import Product, InventoryBatch

from auth_routes import router as auth_router
from domain_routes import router as domain_router
from trips_routes import router as trips_router
from machine_extras_routes import router as machine_extras_router
from ops_routes import router as ops_router
from purchases_routes import router as purchases_router
from assistant_routes import router as assistant_router

load_dotenv()

app = FastAPI()

app.include_router(auth_router)
app.include_router(domain_router)
app.include_router(trips_router)
app.include_router(machine_extras_router)
app.include_router(ops_router)
app.include_router(purchases_router)
app.include_router(assistant_router)


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


import logging
import traceback
from fastapi.responses import JSONResponse
from fastapi.requests import Request

logger = logging.getLogger("uvicorn.error")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Without this, an unhandled 500 skips CORSMiddleware entirely and the
    browser reports it as a CORS error, which is misleading — the real cause
    is always a server-side bug or bad input, not CORS. This makes sure the
    browser gets a real (still CORS-safe) 500 response with a clear message,
    and logs the full traceback server-side for debugging."""
    logger.error("Unhandled exception on %s %s:\n%s", request.method, request.url.path, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error — check the backend logs for details."},
    )

UPLOAD_DIR = Path("uploads")
SEARCHABLE_DIR = Path("uploads_searchable")

from fastapi.staticfiles import StaticFiles
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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





