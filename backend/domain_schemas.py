from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime, date


# ---------- Products ----------

class ProductCreate(BaseModel):
    sku: str
    name: str
    category: str
    unit_size: Optional[str] = None
    units_per_case: Optional[int] = None
    cost_price: float
    sell_price: float
    barcode: Optional[str] = None
    tax_rate: Optional[float] = 0
    active: bool = True
    reorder_point: Optional[int] = 0
    order_up_to_level: Optional[int] = None
    last_supplier: Optional[str] = None
    # Initial Inventory Setup (matches VendSoft's Create Product screen)
    initial_quantity: Optional[int] = 0
    initial_unit_cost: Optional[float] = None


class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    unit_size: Optional[str] = None
    units_per_case: Optional[int] = None
    cost_price: Optional[float] = None
    sell_price: Optional[float] = None
    barcode: Optional[str] = None
    tax_rate: Optional[float] = None
    active: Optional[bool] = None
    reorder_point: Optional[int] = None
    order_up_to_level: Optional[int] = None
    last_supplier: Optional[str] = None
    warehouse_stock: Optional[int] = None


class ProductOut(BaseModel):
    id: UUID
    org_id: UUID
    sku: str
    name: str
    category: str
    unit_size: Optional[str] = None
    units_per_case: Optional[int] = None
    cost_price: float
    sell_price: float
    barcode: Optional[str] = None
    tax_rate: Optional[float] = None
    active: bool
    reorder_point: Optional[int] = None
    order_up_to_level: Optional[int] = None
    warehouse_stock: Optional[int] = None
    last_supplier: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Locations ----------

class LocationCreate(BaseModel):
    code: Optional[str] = None
    active: bool = True
    name: str
    address: str
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = "United States"
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    working_hours: Optional[str] = None
    working_days: Optional[List[str]] = None
    notes: Optional[str] = None
    next_visit: Optional[date] = None
    commission_type: str = "percentage"
    commission_value: float = 0
    payout_frequency: str = "monthly"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LocationUpdate(BaseModel):
    code: Optional[str] = None
    active: Optional[bool] = None
    name: Optional[str] = None
    address: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    working_hours: Optional[str] = None
    working_days: Optional[List[str]] = None
    notes: Optional[str] = None
    next_visit: Optional[date] = None
    commission_type: Optional[str] = None
    commission_value: Optional[float] = None
    payout_frequency: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LocationOut(BaseModel):
    id: UUID
    org_id: UUID
    code: Optional[str] = None
    active: bool
    name: str
    address: str
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    working_hours: Optional[str] = None
    working_days: Optional[List[str]] = None
    notes: Optional[str] = None
    next_visit: Optional[date] = None
    commission_type: str
    commission_value: float
    payout_frequency: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Machines ----------

class MachineCreate(BaseModel):
    name: Optional[str] = None
    external_code: Optional[str] = None
    description: Optional[str] = None
    machine_type: Optional[str] = None
    asset_tag: str
    model: str
    serial: str
    key_code: Optional[str] = None
    placed_on: Optional[date] = None
    notes: Optional[str] = None
    track_vend_meter: bool = False
    track_cash_meter: bool = False
    track_credit_card_sales: bool = False
    column_map_template: Optional[str] = None
    location_id: Optional[UUID] = None
    column_count: Optional[int] = None
    cashless_enabled: bool = False
    telemetry_device_id: Optional[str] = None
    status: str = "active"


class MachineUpdate(BaseModel):
    name: Optional[str] = None
    external_code: Optional[str] = None
    description: Optional[str] = None
    machine_type: Optional[str] = None
    asset_tag: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    key_code: Optional[str] = None
    placed_on: Optional[date] = None
    notes: Optional[str] = None
    track_vend_meter: Optional[bool] = None
    track_cash_meter: Optional[bool] = None
    track_credit_card_sales: Optional[bool] = None
    column_map_template: Optional[str] = None
    location_id: Optional[UUID] = None
    column_count: Optional[int] = None
    cashless_enabled: Optional[bool] = None
    telemetry_device_id: Optional[str] = None
    status: Optional[str] = None


class MachineOut(BaseModel):
    id: UUID
    org_id: UUID
    name: Optional[str] = None
    external_code: Optional[str] = None
    description: Optional[str] = None
    machine_type: Optional[str] = None
    asset_tag: str
    model: str
    serial: str
    key_code: Optional[str] = None
    placed_on: Optional[date] = None
    notes: Optional[str] = None
    track_vend_meter: bool
    track_cash_meter: bool
    track_credit_card_sales: bool
    column_map_template: Optional[str] = None
    location_id: Optional[UUID] = None
    column_count: Optional[int] = None
    cashless_enabled: bool
    telemetry_device_id: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MachinePhotoOut(BaseModel):
    id: UUID
    machine_id: UUID
    file_path: str
    taken_at: datetime

    class Config:
        from_attributes = True


class MachineAttachmentOut(BaseModel):
    id: UUID
    machine_id: UUID
    file_path: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Tickets (Maintenance / Service History) ----------

class TicketCreate(BaseModel):
    machine_id: Optional[UUID] = None
    priority: str = "medium"
    subject: str
    description: str


class TicketUpdate(BaseModel):
    priority: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assigned_user_id: Optional[UUID] = None


class TicketOut(BaseModel):
    id: UUID
    org_id: UUID
    machine_id: Optional[UUID] = None
    priority: str
    subject: str
    description: str
    status: str
    assigned_user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Slots (coils) ----------
# Kept here for import convenience; canonical definitions used across the app.

class SlotCreate(BaseModel):
    position: str
    product_id: Optional[UUID] = None
    price_override: Optional[float] = None
    dex_price: Optional[float] = None
    last_count: Optional[int] = None
    par_level: int = 0
    capacity: int
    current_qty: int = 0


class SlotUpdate(BaseModel):
    position: Optional[str] = None
    product_id: Optional[UUID] = None
    price_override: Optional[float] = None
    dex_price: Optional[float] = None
    last_count: Optional[int] = None
    par_level: Optional[int] = None
    capacity: Optional[int] = None
    current_qty: Optional[int] = None


class SlotOut(BaseModel):
    id: UUID
    machine_id: UUID
    position: str
    product_id: Optional[UUID] = None
    price_override: Optional[float] = None
    dex_price: Optional[float] = None
    last_count: Optional[int] = None
    par_level: int
    capacity: int
    current_qty: int

    class Config:
        from_attributes = True
