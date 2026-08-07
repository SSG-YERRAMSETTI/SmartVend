from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime, date


class ReceiptLineOut(BaseModel):
    id: UUID
    line_type: str
    product_raw: str
    product_id: Optional[UUID] = None
    is_new_product: bool
    match_confidence: str
    quantity: int
    units_per_case: Optional[int] = None
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    expiry_date: Optional[date] = None
    shelf_label: Optional[str] = None
    needs_review: bool
    review_note: Optional[str] = None

    class Config:
        from_attributes = True


class ReceiptOut(BaseModel):
    id: UUID
    org_id: Optional[UUID] = None
    document_type: str
    expense_category: Optional[str] = None
    vendor_name: Optional[str] = None
    receipt_date: Optional[date] = None
    receipt_time: Optional[str] = None
    filename: str
    file_path: Optional[str] = None
    status: str
    total_amount: Optional[float] = None
    missing_prices: bool
    extraction_provider: Optional[str] = None
    raw_text: Optional[str] = None
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    lines: List[ReceiptLineOut] = []

    class Config:
        from_attributes = True


class ReceiptLineUpdate(BaseModel):
    line_type: Optional[str] = None
    product_id: Optional[UUID] = None
    product_raw: Optional[str] = None
    quantity: Optional[int] = None
    units_per_case: Optional[int] = None
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    expiry_date: Optional[date] = None
    shelf_label: Optional[str] = None
    needs_review: Optional[bool] = None


class ReceiptUpdate(BaseModel):
    """For editing an expense-type receipt's summary fields during review."""
    vendor_name: Optional[str] = None
    expense_category: Optional[str] = None
    total_amount: Optional[float] = None
    receipt_date: Optional[date] = None


class NewProductForLine(BaseModel):
    """Used when confirming a line whose product doesn't exist yet."""
    name: str
    category: str = "Uncategorized"
    sku: Optional[str] = None


class InventoryBatchOut(BaseModel):
    id: UUID
    product_id: UUID
    location_type: str
    quantity: int
    unit_cost: float
    expiry_date: Optional[date] = None
    shelf_label: Optional[str] = None
    received_at: datetime

    class Config:
        from_attributes = True


class BatchUpdate(BaseModel):
    """For editing a batch's shelf location after the fact."""
    shelf_label: Optional[str] = None
