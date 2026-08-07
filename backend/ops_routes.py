import uuid
import shutil
from pathlib import Path
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from auth import get_db, get_current_user, require_role
from models import User, MileageLog, Expense, Route, Organization, Product, Slot, Machine, Location, DailySalesSummary
from ops_schemas import (
    MileageLogCreate, MileageLogOut, ExpenseCreate, ExpenseOut, RouteOut,
    OrganizationUpdate, OrganizationOut, DashboardLayoutUpdate, ProfitByRangeOut,
)

router = APIRouter(tags=["ops"])


def _org_scope(current_user: User):
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data to access here")
    return current_user.org_id


# ============================================================
# Dashboard layout (per-user customization)
# ============================================================

DEFAULT_DASHBOARD_WIDGETS = ["stats", "low_stock", "active_trips"]

# Every widget the frontend knows how to render. Keeping this list on the
# backend too so the frontend can validate against it and so future widgets
# have one place to register.
AVAILABLE_WIDGETS = [
    "stats", "low_stock", "active_trips", "top_products", "expiring_soon",
    "margin_snapshot", "recent_tickets", "team", "recent_trips", "expenses_summary",
]


@router.get("/dashboard/layout")
def get_dashboard_layout(current_user: User = Depends(get_current_user)):
    return {
        "widgets": current_user.dashboard_layout.get("widgets", DEFAULT_DASHBOARD_WIDGETS)
        if current_user.dashboard_layout else DEFAULT_DASHBOARD_WIDGETS,
        "available_widgets": AVAILABLE_WIDGETS,
    }


@router.patch("/dashboard/layout")
def update_dashboard_layout(
    payload: DashboardLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invalid = [w for w in payload.widgets if w not in AVAILABLE_WIDGETS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown widget id(s): {invalid}")
    current_user.dashboard_layout = {"widgets": payload.widgets}
    db.commit()
    return {"widgets": payload.widgets}


# ============================================================
# Margin report — cost from receipts vs. actual configured sell prices
# ============================================================

@router.get("/reports/margin-by-product")
def margin_by_product(db: Session = Depends(get_db), current_user: User = Depends(require_role("route_owner"))):
    """For each product, shows the receipt-derived cost against every distinct
    price it's actually sold for across coils/locations right now, with the
    per-unit margin at each price point.

    This is POTENTIAL margin per unit — not realized profit. Realized profit
    needs to know how many units were actually sold, which this system
    doesn't track yet (only restocking, not real vend transactions)."""
    org_id = _org_scope(current_user)

    products = (
        db.query(Product)
        .filter(Product.org_id == org_id, Product.active == True, Product.cost_price > 0)
        .all()
    )

    results = []
    for product in products:
        # Every distinct price this product is actually configured to sell for:
        # its own default sell_price, plus any per-coil price overrides.
        price_points = {}  # price -> list of "Location - Machine (position)" labels
        if product.sell_price and float(product.sell_price) > 0:
            price_points[float(product.sell_price)] = ["Default price (no location override)"]

        slots = (
            db.query(Slot, Machine, Location)
            .join(Machine, Slot.machine_id == Machine.id)
            .outerjoin(Location, Machine.location_id == Location.id)
            .filter(Slot.product_id == product.id, Machine.org_id == org_id)
            .all()
        )
        for slot, machine, location in slots:
            price = float(slot.price_override) if slot.price_override is not None else (
                float(product.sell_price) if product.sell_price else None
            )
            if price is None or price <= 0:
                continue
            label = f"{location.name if location else 'Unassigned'} — {machine.name or machine.asset_tag} (coil {slot.position})"
            price_points.setdefault(price, []).append(label)

        if not price_points:
            continue

        cost = float(product.cost_price)
        price_breakdown = [
            {
                "price": price,
                "margin_dollar": round(price - cost, 4),
                "margin_pct": round((price - cost) / price * 100, 2) if price > 0 else None,
                "locations": labels,
            }
            for price, labels in sorted(price_points.items())
        ]

        results.append({
            "product_id": str(product.id),
            "product_name": product.name,
            "cost_price": cost,
            "last_supplier": product.last_supplier,
            "price_points": price_breakdown,
        })

    results.sort(key=lambda r: r["product_name"])
    return results


# ============================================================
# Mileage Log
# ============================================================

@router.get("/mileage-logs", response_model=list[MileageLogOut])
def list_mileage_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    q = db.query(MileageLog).filter(MileageLog.org_id == org_id)
    if current_user.role == "driver":
        q = q.filter(MileageLog.driver_id == current_user.id)
    return q.order_by(MileageLog.log_date.desc()).all()


@router.post("/mileage-logs", response_model=MileageLogOut)
def create_mileage_log(
    payload: MileageLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    driver_id = payload.driver_id or (current_user.id if current_user.role == "driver" else None)
    log = MileageLog(org_id=org_id, created_by=current_user.id, **{**payload.model_dump(), "driver_id": driver_id})
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/mileage-logs/{log_id}")
def delete_mileage_log(
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    log = db.query(MileageLog).filter(MileageLog.id == log_id, MileageLog.org_id == org_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Mileage log not found")
    db.delete(log)
    db.commit()
    return {"status": "deleted"}


# ============================================================
# Expenses
# ============================================================

@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    q = db.query(Expense).filter(Expense.org_id == org_id)
    if date_from:
        q = q.filter(Expense.expense_date >= date_from)
    if date_to:
        q = q.filter(Expense.expense_date <= date_to)
    return q.order_by(Expense.expense_date.desc()).all()


@router.post("/expenses", response_model=ExpenseOut)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    expense = Expense(org_id=org_id, created_by=current_user.id, **payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


EXPENSE_UPLOAD_DIR = Path("uploads/expenses")


@router.post("/expenses/{expense_id}/photo", response_model=ExpenseOut)
def upload_expense_photo(
    expense_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    """Optional proof photo for a manually-entered expense — a handwritten note,
    an informal receipt, whatever the route owner has. Never required to save
    the expense itself; this can be attached any time after, too."""
    org_id = _org_scope(current_user)
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.org_id == org_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    org_dir = EXPENSE_UPLOAD_DIR / str(org_id)
    org_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest_path = org_dir / safe_name
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    expense.photo_path = str(dest_path)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.org_id == org_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"status": "deleted"}


# ============================================================
# Profit by date range — gross income minus expenses, for a window
# ============================================================

@router.get("/reports/profit-by-range", response_model=ProfitByRangeOut)
def profit_by_range(
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    """Revenue minus every real expense in the window (inventory purchases
    included, since those land in Expenses too at purchase-confirm time) —
    this is the plain "what did we actually make" view, distinct from the
    per-unit Margin report above.

    Revenue is computed from daily_sales_summary joined to product sell price.
    That table is empty until real vend/sale transactions are recorded
    somewhere in the system — so revenue will correctly show $0 until that
    exists. Everything else here (the date filtering, the expense breakdown,
    the subtraction) is fully real today and needs no changes once sales data
    starts flowing in."""
    org_id = _org_scope(current_user)
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="date_to must be on or after date_from")

    revenue_rows = (
        db.query(DailySalesSummary, Product)
        .join(Product, DailySalesSummary.product_id == Product.id)
        .join(Machine, DailySalesSummary.machine_id == Machine.id)
        .filter(
            Machine.org_id == org_id,
            DailySalesSummary.sales_date >= date_from,
            DailySalesSummary.sales_date <= date_to,
        )
        .all()
    )
    revenue = sum(float(s.quantity_sold) * float(p.sell_price or 0) for s, p in revenue_rows)

    expenses = (
        db.query(Expense)
        .filter(Expense.org_id == org_id, Expense.expense_date >= date_from, Expense.expense_date <= date_to)
        .all()
    )
    total_expenses = sum(float(e.amount) for e in expenses)

    by_category: dict = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, 0) + float(e.amount)
    breakdown = [{"category": k, "amount": round(v, 2)} for k, v in sorted(by_category.items(), key=lambda x: -x[1])]

    return ProfitByRangeOut(
        date_from=date_from, date_to=date_to,
        revenue=round(revenue, 2), total_expenses=round(total_expenses, 2),
        profit=round(revenue - total_expenses, 2), expense_breakdown=breakdown,
    )


# ============================================================
# Routes (read-only list; routes are created implicitly via Trip assignment)
# ============================================================

@router.get("/routes", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    q = db.query(Route).filter(Route.org_id == org_id)
    if current_user.role == "driver":
        q = q.filter(Route.assigned_driver_id == current_user.id)
    return q.order_by(Route.created_at.desc()).all()


# ============================================================
# Organization settings (Configuration page)
# ============================================================

@router.get("/organizations/me", response_model=OrganizationOut)
def get_my_organization(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/organizations/me", response_model=OrganizationOut)
def update_my_organization(
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org
