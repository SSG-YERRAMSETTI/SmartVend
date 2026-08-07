from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime, date


# ---------- Trips ----------

class TripCreate(BaseModel):
    driver_id: UUID
    trip_date: date
    machine_ids: List[UUID]  # ordered list — becomes the trip's stops
    route_name: Optional[str] = None  # if omitted, auto-named from the date


class TripOut(BaseModel):
    id: UUID
    org_id: UUID
    route_id: Optional[UUID] = None
    driver_id: UUID
    trip_date: date
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CoilView(BaseModel):
    """A coil (slot) as shown to the driver during a visit, including the
    latest restock entry for THIS route stop if one has already been submitted
    (so the screen can be resumed / edited)."""
    slot_id: UUID
    position: str
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    price: Optional[float] = None  # price_override if set, else the product's sell_price
    capacity: int
    par_level: int
    current_qty_before_trip: int  # slot.current_qty as of before this visit
    current_count: Optional[int] = None
    last_filled_qty: Optional[int] = None
    filled_qty: Optional[int] = None


class MachineVisit(BaseModel):
    route_stop_id: UUID
    machine_id: UUID
    machine_name: Optional[str] = None
    asset_tag: str
    sequence: int
    status: str
    coils: List[CoilView]


class LocationGroup(BaseModel):
    location_id: Optional[UUID] = None
    location_name: str
    machines: List[MachineVisit]


class TripDetailOut(BaseModel):
    trip: TripOut
    locations: List[LocationGroup]


# ---------- Restock entry submission ----------

class RestockEntryInput(BaseModel):
    slot_id: UUID
    current_count: Optional[int] = None
    filled_qty: int = 0
    product_id: Optional[UUID] = None  # if the driver reassigned the coil's product
    price_override: Optional[float] = None  # if the driver changed the price at this coil


class RestockSubmission(BaseModel):
    entries: List[RestockEntryInput]
    mark_completed: bool = True
