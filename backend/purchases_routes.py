import shutil
import uuid
from datetime import datetime, timezone, date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_

from auth import get_db, get_current_user, require_role
from models import (
    User, Receipt, ReceiptLine, Product, InventoryBatch, InventoryLedger,
    Warehouse, ProductSupplierPackaging, Expense,
)
from purchases_schemas import (
    ReceiptOut, ReceiptLineOut, ReceiptLineUpdate, ReceiptUpdate, InventoryBatchOut, BatchUpdate,
)
from receipt_convert import file_to_images
from receipt_ai import extract_receipt, parse_voice_fill

router = APIRouter(tags=["purchases"])

RECEIPT_UPLOAD_DIR = Path("uploads/receipts")


def _org_scope(current_user: User):
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data to access here")
    return current_user.org_id


# ============================================================
# Upload — the core "shift to a better model" replacement
# ============================================================

@router.post("/purchases/upload", response_model=ReceiptOut)
def upload_purchase(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)

    # 1. Save the raw upload
    org_dir = RECEIPT_UPLOAD_DIR / str(org_id)
    org_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest_path = org_dir / safe_name
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # 2. Convert to images (any supported format -> PNG pages)
    try:
        images = file_to_images(dest_path, org_dir / "rendered")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 3. Pull the org's catalog + already-confirmed pack sizes for context
    products = db.query(Product).filter(Product.org_id == org_id).all()
    catalog = [{"id": str(p.id), "name": p.name, "sku": p.sku, "category": p.category} for p in products]
    products_by_name = {p.name: p for p in products}
    products_by_id = {p.id: p for p in products}

    packaging_memory = db.query(ProductSupplierPackaging).filter(ProductSupplierPackaging.org_id == org_id).all()
    known_packaging = [
        {
            "product_name": products_by_id[m.product_id].name,
            "supplier_name": m.supplier_name,
            "units_per_case": m.units_per_case,
        }
        for m in packaging_memory if m.product_id in products_by_id
    ]

    # 4. Run extraction (classifies inventory_purchase vs. expense, then extracts accordingly)
    try:
        result = extract_receipt(images, catalog, known_packaging)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Receipt extraction failed: {e}")

    # 5. Parse receipt_date safely
    receipt_date = None
    if result.get("receipt_date"):
        try:
            receipt_date = datetime.strptime(result["receipt_date"], "%Y-%m-%d").date()
        except ValueError:
            pass

    document_type = result.get("document_type", "inventory_purchase")
    if document_type not in ("inventory_purchase", "expense"):
        document_type = "inventory_purchase"

    receipt = Receipt(
        org_id=org_id,
        document_type=document_type,
        expense_category=result.get("expense_category") if document_type == "expense" else None,
        vendor_name=result.get("vendor_name"),
        receipt_date=receipt_date,
        receipt_time=result.get("receipt_time"),
        source="upload",
        raw_text=result.get("_raw_text"),
        filename=file.filename,
        file_path=str(dest_path),
        status="pending_review",
        total_amount=result.get("total_amount"),
        extraction_provider=result.get("extraction_provider"),
        created_by=current_user.id,
    )
    db.add(receipt)
    db.flush()

    # Expense documents skip product-line matching entirely — nothing more to do
    # here, the review screen just shows category/amount/date for confirmation.
    if document_type == "expense":
        db.commit()
        db.refresh(receipt)
        return receipt

    any_missing_price = False
    for line in result.get("lines", []):
        matched_product = products_by_name.get(line.get("matched_product_name") or "")

        # Apply remembered supplier-specific pack size if the AI didn't extract one
        units_per_case = line.get("units_per_case")
        if units_per_case is None and matched_product and receipt.vendor_name:
            memory = (
                db.query(ProductSupplierPackaging)
                .filter(
                    ProductSupplierPackaging.org_id == org_id,
                    ProductSupplierPackaging.product_id == matched_product.id,
                    ProductSupplierPackaging.supplier_name == receipt.vendor_name,
                )
                .first()
            )
            if memory:
                units_per_case = memory.units_per_case

        line_type = line.get("line_type", "product")
        unit_price = line.get("unit_price")
        if line_type == "product" and unit_price is None:
            any_missing_price = True

        db.add(ReceiptLine(
            receipt_id=receipt.id,
            line_type=line_type,
            product_raw=line.get("product_raw", ""),
            product_id=matched_product.id if matched_product else None,
            is_new_product=(line.get("match_confidence") == "new"),
            match_confidence=line.get("match_confidence", "needs_review"),
            quantity=line.get("quantity") or 0,
            units_per_case=units_per_case,
            unit_cost=unit_price,
            total_cost=line.get("line_total"),
            needs_review=(line.get("match_confidence") in ("needs_review", "new")) or unit_price is None,
            review_note=line.get("reasoning"),
        ))

    receipt.missing_prices = any_missing_price
    db.commit()
    db.refresh(receipt)
    return receipt


# ============================================================
# List / detail
# ============================================================

@router.get("/purchases", response_model=list[ReceiptOut])
def list_purchases(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _org_scope(current_user)
    q = db.query(Receipt).filter(Receipt.org_id == org_id)
    if status:
        q = q.filter(Receipt.status == status)
    return q.order_by(Receipt.created_at.desc()).all()


@router.get("/purchases/{receipt_id}", response_model=ReceiptOut)
def get_purchase(receipt_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return receipt


@router.patch("/purchases/{receipt_id}", response_model=ReceiptOut)
def update_purchase(
    receipt_id: uuid.UUID,
    payload: ReceiptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    """Edit an expense-type receipt's summary fields (vendor, category, amount,
    date) during review — the equivalent of editing a product line, but for the
    one-line "this whole document is an expense" case."""
    org_id = _org_scope(current_user)
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if receipt.status != "pending_review":
        raise HTTPException(status_code=400, detail="This purchase has already been confirmed")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(receipt, field, value)
    db.commit()
    db.refresh(receipt)
    return receipt


# ============================================================
# Review — edit lines before confirming
# ============================================================

@router.patch("/purchases/{receipt_id}/lines/{line_id}", response_model=ReceiptLineOut)
def update_purchase_line(
    receipt_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: ReceiptLineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if receipt.status != "pending_review":
        raise HTTPException(status_code=400, detail="This purchase has already been confirmed")

    line = db.query(ReceiptLine).filter(ReceiptLine.id == line_id, ReceiptLine.receipt_id == receipt_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(line, field, value)

    # If the user just supplied a price or a product match, clear needs_review
    if line.unit_cost is not None and line.product_id is not None and payload.needs_review is None:
        line.needs_review = False
        line.match_confidence = "matched"

    db.commit()

    # Recompute the receipt-level missing_prices flag
    remaining_missing = (
        db.query(ReceiptLine)
        .filter(ReceiptLine.receipt_id == receipt_id, ReceiptLine.line_type == "product", ReceiptLine.unit_cost.is_(None))
        .count()
    )
    receipt.missing_prices = remaining_missing > 0
    db.commit()
    db.refresh(line)
    return line


@router.delete("/purchases/{receipt_id}/lines/{line_id}")
def delete_purchase_line(
    receipt_id: uuid.UUID,
    line_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if receipt.status != "pending_review":
        raise HTTPException(status_code=400, detail="This purchase has already been confirmed")
    line = db.query(ReceiptLine).filter(ReceiptLine.id == line_id, ReceiptLine.receipt_id == receipt_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    db.delete(line)
    db.commit()
    return {"status": "deleted"}


# ============================================================
# Voice fill — speak product name + expiration (+ pack size if missing)
# ============================================================

@router.post("/purchases/{receipt_id}/voice-fill")
def voice_fill(
    receipt_id: uuid.UUID,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    """Accepts a voice recording, matches what was said against this receipt's
    product lines, and returns a transcript plus suggested fills — nothing is
    written to the database here. The frontend shows the transcript and the
    proposed changes, and applies them via the normal line-update endpoint,
    so voice fill goes through the exact same validated write path as typing."""
    org_id = _org_scope(current_user)
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if receipt.document_type != "inventory_purchase":
        raise HTTPException(status_code=400, detail="Voice fill only applies to inventory purchase lines")

    lines = (
        db.query(ReceiptLine)
        .filter(ReceiptLine.receipt_id == receipt_id, ReceiptLine.line_type == "product")
        .order_by(ReceiptLine.created_at)
        .all()
    )
    if not lines:
        raise HTTPException(status_code=400, detail="No product lines on this receipt yet")

    line_lookup = {i + 1: line for i, line in enumerate(lines)}
    product_lines_context = [
        {
            "line_number": i + 1,
            "product_raw": line.product_raw,
            "units_per_case": line.units_per_case,
            "expiry_date": line.expiry_date.isoformat() if line.expiry_date else None,
        }
        for i, line in enumerate(lines)
    ]

    audio_bytes = audio.file.read()
    mime_type = audio.content_type or "audio/webm"

    try:
        result = parse_voice_fill(audio_bytes, mime_type, product_lines_context, date.today().isoformat())
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Voice parsing failed: {e}")

    actions = []
    for a in result.get("actions", []):
        line = line_lookup.get(a.get("line_number"))
        if not line:
            continue
        actions.append({
            "line_id": str(line.id),
            "product_raw": line.product_raw,
            "expiration_date": a.get("expiration_date"),
            "units_per_case": a.get("units_per_case"),
            "skip": bool(a.get("skip")),
        })

    return {"transcript": result.get("transcript", ""), "actions": actions}




def do_confirm_purchase(db: Session, org_id, current_user: User, receipt_id: uuid.UUID) -> Receipt:
    """Shared confirm logic — used by both the REST endpoint and the assistant's
    confirm_purchase tool, so there's exactly one implementation to trust."""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if receipt.status != "pending_review":
        raise HTTPException(status_code=400, detail=f"This purchase is already {receipt.status}")

    # ---- Expense-type document: no inventory involved at all ----
    if receipt.document_type == "expense":
        if not receipt.total_amount:
            raise HTTPException(status_code=400, detail="This expense has no amount yet — enter one before confirming.")
        if not receipt.expense_category:
            raise HTTPException(status_code=400, detail="Pick an expense category before confirming.")

        db.add(Expense(
            org_id=org_id,
            expense_date=receipt.receipt_date or date.today(),
            category=receipt.expense_category,
            vendor_name=receipt.vendor_name,
            amount=receipt.total_amount,
            notes=f"{receipt.vendor_name or 'Unknown vendor'} — {receipt.filename}",
            photo_path=receipt.file_path,
            receipt_id=receipt.id,
            created_by=current_user.id,
        ))
        receipt.status = "confirmed"
        receipt.confirmed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(receipt)
        return receipt

    # ---- Inventory purchase: existing full flow ----
    lines = db.query(ReceiptLine).filter(ReceiptLine.receipt_id == receipt_id).all()
    product_lines = [l for l in lines if l.line_type == "product"]

    if not product_lines:
        raise HTTPException(status_code=400, detail="No product lines to confirm")

    missing_price_lines = [l for l in product_lines if l.unit_cost is None]
    if missing_price_lines:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing_price_lines)} line(s) have no price yet. "
                   f"Enter a price for each, or upload a version of this receipt that shows prices, before confirming.",
        )
    unmatched_lines = [l for l in product_lines if l.product_id is None]
    if unmatched_lines:
        raise HTTPException(
            status_code=400,
            detail=f"{len(unmatched_lines)} line(s) aren't matched to a product yet. "
                   f"Match each to an existing product or create a new one before confirming.",
        )

    warehouse = db.query(Warehouse).filter(Warehouse.org_id == org_id).first()
    if not warehouse:
        raise HTTPException(status_code=500, detail="No warehouse found for this organization")

    total_amount = receipt.total_amount or sum(float(l.total_cost or 0) for l in product_lines)

    for line in product_lines:
        units_per_case = line.units_per_case or 1
        individual_qty = line.quantity * units_per_case
        per_unit_cost = float(line.unit_cost) / units_per_case if units_per_case else float(line.unit_cost)

        product = db.query(Product).filter(Product.id == line.product_id, Product.org_id == org_id).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product for line '{line.product_raw}' not found")

        product.warehouse_stock = (product.warehouse_stock or 0) + individual_qty
        product.cost_price = round(per_unit_cost, 4)
        if receipt.vendor_name:
            product.last_supplier = receipt.vendor_name

        db.add(InventoryBatch(
            org_id=org_id,
            product_id=product.id,
            location_type="warehouse",
            location_id=warehouse.id,
            batch_number=f"RCPT-{str(receipt.id)[:8]}",
            quantity=individual_qty,
            unit_cost=round(per_unit_cost, 4),
            expiry_date=line.expiry_date,
            shelf_label=line.shelf_label,
        ))

        db.add(InventoryLedger(
            org_id=org_id,
            entity_type="warehouse",
            entity_id=warehouse.id,
            product_id=product.id,
            qty_change=individual_qty,
            reason="purchase_receipt",
            ref_doc=str(receipt.id),
            created_by=current_user.id,
        ))

        # Remember this supplier's pack size for next time, if we have one
        if line.units_per_case and receipt.vendor_name:
            memory = (
                db.query(ProductSupplierPackaging)
                .filter(
                    ProductSupplierPackaging.org_id == org_id,
                    ProductSupplierPackaging.product_id == product.id,
                    ProductSupplierPackaging.supplier_name == receipt.vendor_name,
                )
                .first()
            )
            if memory:
                memory.units_per_case = line.units_per_case
            else:
                db.add(ProductSupplierPackaging(
                    org_id=org_id, product_id=product.id,
                    supplier_name=receipt.vendor_name, units_per_case=line.units_per_case,
                ))

    # Purchase cost lands in Expenses too, so Reports can subtract total spend from sales
    db.add(Expense(
        org_id=org_id,
        expense_date=receipt.receipt_date or date.today(),
        category="Inventory Purchase",
        vendor_name=receipt.vendor_name,
        amount=total_amount,
        notes=f"{receipt.vendor_name or 'Unknown supplier'} — {receipt.filename}",
        receipt_id=receipt.id,
        created_by=current_user.id,
    ))

    receipt.status = "confirmed"
    receipt.confirmed_at = datetime.now(timezone.utc)
    receipt.total_amount = total_amount
    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/purchases/{receipt_id}/confirm", response_model=ReceiptOut)
def confirm_purchase(
    receipt_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    return do_confirm_purchase(db, org_id, current_user, receipt_id)


@router.post("/purchases/{receipt_id}/reject")
def reject_purchase(
    receipt_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.org_id == org_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Purchase not found")
    receipt.status = "rejected"
    db.commit()
    return {"status": "rejected"}


# ============================================================
# Expiration tracking
# ============================================================

@router.get("/products/{product_id}/batches", response_model=list[InventoryBatchOut])
def list_product_batches(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    product = db.query(Product).filter(Product.id == product_id, Product.org_id == org_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return (
        db.query(InventoryBatch)
        .filter(InventoryBatch.product_id == product_id, InventoryBatch.org_id == org_id, InventoryBatch.quantity > 0)
        .order_by(InventoryBatch.expiry_date.asc().nulls_last())
        .all()
    )


@router.patch("/batches/{batch_id}", response_model=InventoryBatchOut)
def update_batch(
    batch_id: uuid.UUID,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    """Set or change a batch's shelf location — typically done once it's actually
    been put away in the warehouse, separate from the purchase-confirm step."""
    org_id = _org_scope(current_user)
    batch = db.query(InventoryBatch).filter(InventoryBatch.id == batch_id, InventoryBatch.org_id == org_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/inventory/expiring-soon")
def get_expiring_soon(
    days: int = 14,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _org_scope(current_user)
    cutoff = date.today() + timedelta(days=days)
    batches = (
        db.query(InventoryBatch, Product)
        .join(Product, InventoryBatch.product_id == Product.id)
        .filter(
            InventoryBatch.org_id == org_id,
            InventoryBatch.quantity > 0,
            InventoryBatch.expiry_date.isnot(None),
            InventoryBatch.expiry_date <= cutoff,
        )
        .order_by(InventoryBatch.expiry_date.asc())
        .all()
    )
    return [
        {
            "batch_id": str(b.id),
            "product_id": str(p.id),
            "product_name": p.name,
            "quantity": b.quantity,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "purchased_date": b.received_at.date().isoformat() if b.received_at else None,
            "shelf_label": b.shelf_label,
            "days_until_expiry": (b.expiry_date - date.today()).days if b.expiry_date else None,
        }
        for b, p in batches
    ]
