from sqlalchemy.orm import declarative_base, relationship
from uuid import uuid4
from sqlalchemy import (
    Column, Text, Date, DateTime, Numeric, Boolean,
    ForeignKey, Integer, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

Base = declarative_base()


# ============================================================
# Auth / tenancy
# ============================================================

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    email = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    full_name = Column(Text)
    role = Column(Text, nullable=False)  # 'platform_admin' | 'route_owner' | 'driver'
    is_active = Column(Boolean, nullable=False, default=True)
    dashboard_layout = Column(JSONB)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ============================================================
# Domain tables
# ============================================================

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    sku = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    category = Column(Text, nullable=False)
    unit_size = Column(Text)
    units_per_case = Column(Integer)
    cost_price = Column(Numeric(10, 2), nullable=False)
    sell_price = Column(Numeric(10, 2), nullable=False)
    barcode = Column(Text)
    tax_rate = Column(Numeric(5, 2), default=0)
    active = Column(Boolean, default=True)
    reorder_point = Column(Integer, default=0)
    order_up_to_level = Column(Integer)
    warehouse_stock = Column(Integer, default=0)
    last_supplier = Column(Text)
    image_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    batches = relationship("InventoryBatch", back_populates="product")


class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    address = Column(Text, nullable=False)
    contact = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    plate = Column(Text, nullable=False)
    capacity = Column(Numeric(10, 2))
    assigned_driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Location(Base):
    __tablename__ = "locations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    code = Column(Text)
    active = Column(Boolean, nullable=False, default=True)
    name = Column(Text, nullable=False)
    address = Column(Text, nullable=False)
    address_line2 = Column(Text)
    city = Column(Text)
    state_province = Column(Text)
    zip = Column(Text)
    country = Column(Text, default="United States")
    contact_name = Column(Text)
    contact_phone = Column(Text)
    contact_email = Column(Text)
    working_hours = Column(Text)
    working_days = Column(ARRAY(Text), default=lambda: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])
    notes = Column(Text)
    next_visit = Column(Date)
    commission_type = Column(Text, nullable=False, default="percentage")
    commission_value = Column(Numeric(10, 2), nullable=False)
    payout_frequency = Column(Text, nullable=False, default="monthly")
    latitude = Column(Numeric)
    longitude = Column(Numeric)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Machine(Base):
    __tablename__ = "machines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text)
    external_code = Column(Text)
    description = Column(Text)
    machine_type = Column(Text)
    asset_tag = Column(Text, nullable=False)
    model = Column(Text, nullable=False)
    serial = Column(Text, nullable=False)
    key_code = Column(Text)
    placed_on = Column(Date)
    notes = Column(Text)
    track_vend_meter = Column(Boolean, default=False)
    track_cash_meter = Column(Boolean, default=False)
    track_credit_card_sales = Column(Boolean, default=False)
    column_map_template = Column(Text)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"))
    planogram_id = Column(UUID(as_uuid=True))
    column_count = Column(Integer)
    cashless_enabled = Column(Boolean, default=False)
    telemetry_device_id = Column(Text)
    status = Column(Text, nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class MachinePhoto(Base):
    __tablename__ = "machine_photos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(Text, nullable=False)
    taken_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class MachineAttachment(Base):
    __tablename__ = "machine_attachments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(Text, nullable=False)
    filename = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class Slot(Base):
    __tablename__ = "slots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    position = Column(Text, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    price_override = Column(Numeric(10, 2))
    dex_price = Column(Numeric(10, 2))
    last_count = Column(Integer)
    par_level = Column(Integer, nullable=False, default=0)
    capacity = Column(Integer, nullable=False)
    current_qty = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class InventoryLedger(Base):
    __tablename__ = "inventory_ledger"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(Text, nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    qty_change = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    ref_doc = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Route(Base):
    __tablename__ = "routes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    frequency = Column(Text, nullable=False, default="daily")
    start_warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"))
    assigned_driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class Trip(Base):
    __tablename__ = "trips"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"))
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    trip_date = Column(Date, nullable=False)
    status = Column(Text, nullable=False, default="assigned")  # assigned | in_progress | completed
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RouteStop(Base):
    __tablename__ = "route_stops"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"))
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    planned_date = Column(Date, nullable=False)
    sequence = Column(Integer, nullable=False)
    status = Column(Text, nullable=False, default="pending")
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class RestockEntry(Base):
    __tablename__ = "restock_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    route_stop_id = Column(UUID(as_uuid=True), ForeignKey("route_stops.id", ondelete="CASCADE"), nullable=False)
    slot_id = Column(UUID(as_uuid=True), ForeignKey("slots.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    current_count = Column(Integer)
    last_filled_qty = Column(Integer)
    filled_qty = Column(Integer)
    price_at_restock = Column(Numeric(10, 2))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RefillOrder(Base):
    __tablename__ = "refill_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    route_stop_id = Column(UUID(as_uuid=True), ForeignKey("route_stops.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    required_qty = Column(Integer, nullable=False)
    picked_qty = Column(Integer, default=0)
    fulfilled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class TelemetryEvent(Base):
    __tablename__ = "telemetry_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    event_type = Column(Text, nullable=False)
    payload_json = Column(JSONB)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Sale(Base):
    __tablename__ = "sales"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(Text, nullable=False)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    batch_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashCollection(Base):
    __tablename__ = "cash_collections"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    route_stop_id = Column(UUID(as_uuid=True), ForeignKey("route_stops.id"))
    expected_cash = Column(Numeric(10, 2), nullable=False)
    counted_cash = Column(Numeric(10, 2), nullable=False)
    collected_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class CommissionStatement(Base):
    __tablename__ = "commission_statements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    gross_sales = Column(Numeric(10, 2), nullable=False)
    adjustments = Column(Numeric(10, 2), default=0)
    commission_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Text, nullable=False, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"))
    priority = Column(Text, nullable=False, default="medium")
    subject = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="open")
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class PriceList(Base):
    __tablename__ = "price_lists"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class PriceListItem(Base):
    __tablename__ = "price_list_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    price_list_id = Column(UUID(as_uuid=True), ForeignKey("price_lists.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    sell_price = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    location_type = Column(Text, nullable=False)  # 'warehouse' | 'vehicle' | 'machine'
    location_id = Column(UUID(as_uuid=True), nullable=False)
    batch_number = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Numeric, nullable=False)
    expiry_date = Column(Date)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    shelf_label = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="batches")


class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    from_location_type = Column(Text, nullable=False)
    from_location_id = Column(UUID(as_uuid=True))
    to_location_type = Column(Text, nullable=False)
    to_location_id = Column(UUID(as_uuid=True))
    quantity = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    condition_json = Column(JSONB, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"))
    rule_id = Column(UUID(as_uuid=True), ForeignKey("alert_rules.id"))
    message = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Webhook(Base):
    __tablename__ = "webhooks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    events = Column(ARRAY(Text), nullable=False, default=list)
    secret = Column(Text, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    key_hash = Column(Text, nullable=False, unique=True)
    key_prefix = Column(Text, nullable=False)
    scopes = Column(ARRAY(Text), nullable=False, default=lambda: ["read"])
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    table_name = Column(Text, nullable=False)
    record_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(Text, nullable=False)
    old_data = Column(JSONB)
    new_data = Column(JSONB)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# Backend-native tables (already existed locally, kept as-is)
# ============================================================

class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    document_type = Column(Text, nullable=False, default="inventory_purchase")
    expense_category = Column(Text)
    vendor_name = Column(Text)
    receipt_date = Column(Date)
    receipt_time = Column(Text)
    source = Column(Text, nullable=False, default="upload")
    raw_text = Column(Text)
    filename = Column(Text, nullable=False)
    file_path = Column(Text)
    status = Column(Text, nullable=False, default="pending_review")
    total_amount = Column(Numeric)
    missing_prices = Column(Boolean, nullable=False, default=False)
    extraction_provider = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    lines = relationship("ReceiptLine", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptLine(Base):
    __tablename__ = "receipt_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    receipt_id = Column(UUID(as_uuid=True), ForeignKey("receipts.id", ondelete="CASCADE"))
    line_type = Column(Text, nullable=False, default="product")
    product_raw = Column(Text, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    is_new_product = Column(Boolean, nullable=False, default=False)
    match_confidence = Column(Text, nullable=False, default="matched")
    quantity = Column(Integer, nullable=False)
    units_per_case = Column(Integer)
    unit_cost = Column(Numeric)
    total_cost = Column(Numeric)
    expiry_date = Column(Date)
    shelf_label = Column(Text)
    needs_review = Column(Boolean, nullable=False, default=False)
    review_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receipt = relationship("Receipt", back_populates="lines")


class ProductSupplierPackaging(Base):
    __tablename__ = "product_supplier_packaging"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    supplier_name = Column(Text, nullable=False)
    units_per_case = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MachineInventory(Base):
    __tablename__ = "machine_inventory"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DailySalesSummary(Base):
    __tablename__ = "daily_sales_summary"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    sales_date = Column(Date, nullable=False)
    quantity_sold = Column(Integer, nullable=False)


class MileageLog(Base):
    __tablename__ = "mileage_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"))
    log_date = Column(Date, nullable=False)
    start_odometer = Column(Numeric)
    end_odometer = Column(Numeric)
    miles = Column(Numeric, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    expense_date = Column(Date, nullable=False)
    category = Column(Text, nullable=False)
    vendor_name = Column(Text)
    amount = Column(Numeric(10, 2), nullable=False)
    notes = Column(Text)
    photo_path = Column(Text)
    receipt_id = Column(UUID(as_uuid=True), ForeignKey("receipts.id"))
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
