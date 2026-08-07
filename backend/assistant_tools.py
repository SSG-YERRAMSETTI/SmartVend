"""
The actual work behind each tool the assistant can call. Read-only tools run
immediately when the model asks for them. The one write tool (confirm_purchase)
is never auto-executed — see assistant_routes.py for the confirmation flow.
"""
import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

from models import (
    User, Product, Machine, Location, Trip, Ticket, Receipt, InventoryBatch,
    Slot,
)
from purchases_routes import do_confirm_purchase

VALID_PAGES = {
    "dashboard": "/app", "products": "/app/products", "machines": "/app/machines",
    "locations": "/app/locations", "trips": "/app/trips", "purchases": "/app/purchases",
    "tickets": "/app/tickets", "mileage": "/app/mileage", "expenses": "/app/expenses",
    "reports": "/app/reports", "calendar": "/app/calendar", "routes": "/app/routes",
    "team": "/app/admin/users", "configuration": "/app/configuration",
}


def get_dashboard_summary(db: Session, org_id, **_):
    return {
        "products": db.query(Product).filter(Product.org_id == org_id).count(),
        "machines": db.query(Machine).filter(Machine.org_id == org_id).count(),
        "locations": db.query(Location).filter(Location.org_id == org_id).count(),
        "active_trips": db.query(Trip).filter(Trip.org_id == org_id, Trip.status != "completed").count(),
        "open_tickets": db.query(Ticket).filter(Ticket.org_id == org_id, Ticket.status.notin_(["resolved", "closed"])).count(),
    }


def get_low_stock_products(db: Session, org_id, limit: int = 10, **_):
    products = (
        db.query(Product)
        .filter(Product.org_id == org_id, Product.active == True)
        .all()
    )
    low = [p for p in products if (p.warehouse_stock or 0) <= (p.reorder_point or 0)]
    low.sort(key=lambda p: (p.warehouse_stock or 0))
    return [
        {"name": p.name, "warehouse_stock": p.warehouse_stock, "reorder_point": p.reorder_point}
        for p in low[:limit]
    ]


def get_expiring_batches(db: Session, org_id, days: int = 14, **_):
    cutoff = date.today() + timedelta(days=days)
    batches = (
        db.query(InventoryBatch, Product)
        .join(Product, InventoryBatch.product_id == Product.id)
        .filter(
            InventoryBatch.org_id == org_id, InventoryBatch.quantity > 0,
            InventoryBatch.expiry_date.isnot(None), InventoryBatch.expiry_date <= cutoff,
        )
        .order_by(InventoryBatch.expiry_date.asc())
        .all()
    )
    return [
        {"product_name": p.name, "quantity": b.quantity, "expiry_date": b.expiry_date.isoformat()}
        for b, p in batches
    ]


def get_pending_purchases(db: Session, org_id, **_):
    receipts = db.query(Receipt).filter(Receipt.org_id == org_id, Receipt.status == "pending_review").all()
    return [
        {
            "id": str(r.id), "vendor_name": r.vendor_name, "total_amount": float(r.total_amount) if r.total_amount else None,
            "filename": r.filename, "missing_prices": r.missing_prices,
        }
        for r in receipts
    ]


def get_open_tickets(db: Session, org_id, **_):
    tickets = (
        db.query(Ticket)
        .filter(Ticket.org_id == org_id, Ticket.status.notin_(["resolved", "closed"]))
        .order_by(Ticket.created_at.desc())
        .all()
    )
    return [{"id": str(t.id), "subject": t.subject, "priority": t.priority, "status": t.status} for t in tickets]


def get_active_trips(db: Session, org_id, **_):
    trips = db.query(Trip).filter(Trip.org_id == org_id, Trip.status != "completed").order_by(Trip.trip_date).all()
    return [{"id": str(t.id), "trip_date": t.trip_date.isoformat(), "status": t.status} for t in trips]


def get_margin_snapshot(db: Session, org_id, limit: int = 5, **_):
    products = (
        db.query(Product)
        .filter(Product.org_id == org_id, Product.active == True, Product.cost_price > 0, Product.sell_price > 0)
        .all()
    )
    rows = [
        {
            "name": p.name,
            "cost_price": float(p.cost_price),
            "sell_price": float(p.sell_price),
            "margin_pct": round((float(p.sell_price) - float(p.cost_price)) / float(p.sell_price) * 100, 1),
        }
        for p in products
    ]
    rows.sort(key=lambda r: r["margin_pct"], reverse=True)
    return rows[:limit]


def navigate_to(db: Session, org_id, page: str, **_):
    page_key = page.lower().strip()
    if page_key not in VALID_PAGES:
        return {"error": f"Unknown page '{page}'. Valid pages: {list(VALID_PAGES.keys())}"}
    return {"navigate": VALID_PAGES[page_key]}


# ---------- The one write tool — never auto-executed, see assistant_routes.py ----------

def confirm_purchase_tool(db: Session, org_id, current_user: User, receipt_id: str, **_):
    receipt = do_confirm_purchase(db, org_id, current_user, uuid.UUID(receipt_id))
    return {
        "status": "confirmed", "vendor_name": receipt.vendor_name,
        "total_amount": float(receipt.total_amount) if receipt.total_amount else None,
    }


READ_ONLY_TOOLS = {
    "get_dashboard_summary": get_dashboard_summary,
    "get_low_stock_products": get_low_stock_products,
    "get_expiring_batches": get_expiring_batches,
    "get_pending_purchases": get_pending_purchases,
    "get_open_tickets": get_open_tickets,
    "get_active_trips": get_active_trips,
    "get_margin_snapshot": get_margin_snapshot,
    "navigate_to": navigate_to,
}

WRITE_TOOLS = {
    "confirm_purchase": confirm_purchase_tool,
}
