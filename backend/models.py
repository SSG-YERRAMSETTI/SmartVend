from sqlalchemy.orm import declarative_base, relationship
from uuid import uuid4
from sqlalchemy import (
    Column, Text, Date, DateTime, Numeric, Boolean,
    ForeignKey, Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from sqlalchemy import Column, Text, Date, DateTime, Numeric, Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    sku = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    category = Column(Text, nullable=False)
    unit_size = Column(Text)
    cost_price = Column(Numeric(10,2), nullable=False)
    sell_price = Column(Numeric(10,2), nullable=False)
    barcode = Column(Text)
    tax_rate = Column(Numeric(5,2), default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # extra columns from ALTER TABLE
    reorder_point = Column(Integer, default=0)
    warehouse_stock = Column(Integer, default=0)

    batches = relationship("InventoryBatch", back_populates="product")

class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    location_type = Column(Text, nullable=False)  # 'warehouse' | 'vehicle' | 'machine'
    location_id = Column(UUID(as_uuid=True), nullable=False)
    batch_number = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Numeric, nullable=False)
    expiry_date = Column(Date)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="batches")

class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    vendor_name = Column(Text)
    receipt_date = Column(Date)
    source = Column(Text, nullable=False, default="upload")
    raw_text = Column(Text)
    filename = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship("ReceiptLine", back_populates="receipt", cascade="all, delete-orphan")

class ReceiptLine(Base):
    __tablename__ = "receipt_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    receipt_id = Column(UUID(as_uuid=True), ForeignKey("receipts.id", ondelete="CASCADE"))
    product_raw = Column(Text, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric, nullable=False)
    total_cost = Column(Numeric, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receipt = relationship("Receipt", back_populates="lines")


class MachineInventory(Base):
    __tablename__ = "machine_inventory"

    id = Column(UUID(as_uuid=True), primary_key=True)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class DailySalesSummary(Base):
    __tablename__ = "daily_sales_summary"

    id = Column(UUID(as_uuid=True), primary_key=True)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    sales_date = Column(Date, nullable=False)
    quantity_sold = Column(Integer, nullable=False)
