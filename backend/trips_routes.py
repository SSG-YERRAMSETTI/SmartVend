import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_db, get_current_user, require_role
from models import (
    User, Machine, Location, Slot, Route, RouteStop, Trip,
    RestockEntry, Product, InventoryLedger, Warehouse,
)
from domain_schemas import SlotOut, SlotCreate, SlotUpdate
from trips_schemas import (
    TripCreate, TripOut, TripDetailOut, LocationGroup, MachineVisit, CoilView,
    RestockSubmission,
)

router = APIRouter(tags=["trips"])


def _org_scope(current_user: User):
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data to access here")
    return current_user.org_id


def _driver_can_touch_machine(db: Session, driver: User, machine_id: uuid.UUID) -> bool:
    """A driver may only edit coils for a machine that's on one of their
    non-completed trips — not just any machine in the org."""
    stop = (
        db.query(RouteStop)
        .join(Trip, RouteStop.trip_id == Trip.id)
        .filter(
            Trip.driver_id == driver.id,
            RouteStop.machine_id == machine_id,
            RouteStop.status != "completed",
        )
        .first()
    )
    return stop is not None


# ============================================================
# Slots (coils) — viewable/editable by both route_owner and driver
# ============================================================

@router.get("/machines/{machine_id}/slots", response_model=list[SlotOut])
def list_slots(machine_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.org_id == org_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return db.query(Slot).filter(Slot.machine_id == machine_id).order_by(Slot.position).all()


@router.post("/machines/{machine_id}/slots", response_model=SlotOut)
def create_slot(
    machine_id: uuid.UUID,
    payload: SlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.org_id == org_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    existing = db.query(Slot).filter(Slot.machine_id == machine_id, Slot.position == payload.position).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Coil '{payload.position}' already exists on this machine")
    slot = Slot(machine_id=machine_id, created_by=current_user.id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.patch("/slots/{slot_id}", response_model=SlotOut)
def update_slot(
    slot_id: uuid.UUID,
    payload: SlotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    slot = db.query(Slot).join(Machine).filter(Slot.id == slot_id, Machine.org_id == org_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Coil not found")

    if current_user.role == "driver" and not _driver_can_touch_machine(db, current_user, slot.machine_id):
        raise HTTPException(status_code=403, detail="This coil isn't on one of your active trips")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(slot, field, value)
    slot.updated_by = current_user.id
    db.commit()
    db.refresh(slot)
    return slot


# ============================================================
# Trips
# ============================================================

@router.post("/trips", response_model=TripOut)
def create_trip(
    payload: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)

    driver = db.query(User).filter(User.id == payload.driver_id, User.org_id == org_id, User.role == "driver").first()
    if not driver:
        raise HTTPException(status_code=400, detail="driver_id must be an active driver in your organization")

    machines = db.query(Machine).filter(Machine.id.in_(payload.machine_ids), Machine.org_id == org_id).all()
    if len(machines) != len(payload.machine_ids):
        raise HTTPException(status_code=400, detail="One or more machine_ids are invalid for your organization")
    machines_by_id = {m.id: m for m in machines}

    route = Route(
        org_id=org_id,
        name=payload.route_name or f"Trip {payload.trip_date.isoformat()} — {driver.full_name or driver.email}",
        frequency="custom",
        assigned_driver_id=driver.id,
        created_by=current_user.id,
    )
    db.add(route)
    db.flush()

    trip = Trip(
        org_id=org_id,
        route_id=route.id,
        driver_id=driver.id,
        trip_date=payload.trip_date,
        status="assigned",
        created_by=current_user.id,
    )
    db.add(trip)
    db.flush()

    for i, machine_id in enumerate(payload.machine_ids):
        stop = RouteStop(
            route_id=route.id,
            trip_id=trip.id,
            machine_id=machine_id,
            planned_date=payload.trip_date,
            sequence=i,
            status="pending",
            created_by=current_user.id,
        )
        db.add(stop)

    db.commit()
    db.refresh(trip)
    return trip


@router.get("/trips", response_model=list[TripOut])
def list_trips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    q = db.query(Trip).filter(Trip.org_id == org_id)
    if current_user.role == "driver":
        q = q.filter(Trip.driver_id == current_user.id)
    return q.order_by(Trip.trip_date.desc()).all()


@router.get("/trips/{trip_id}", response_model=TripDetailOut)
def get_trip_detail(trip_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.org_id == org_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user.role == "driver" and trip.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="This trip isn't assigned to you")

    stops = (
        db.query(RouteStop)
        .filter(RouteStop.trip_id == trip_id)
        .order_by(RouteStop.sequence)
        .all()
    )

    groups: dict = {}
    order: list = []
    for stop in stops:
        machine = db.query(Machine).filter(Machine.id == stop.machine_id).first()
        location = db.query(Location).filter(Location.id == machine.location_id).first() if machine.location_id else None
        loc_key = str(location.id) if location else "unassigned"
        if loc_key not in groups:
            groups[loc_key] = LocationGroup(
                location_id=location.id if location else None,
                location_name=location.name if location else "Unassigned",
                machines=[],
            )
            order.append(loc_key)

        slots = db.query(Slot).filter(Slot.machine_id == machine.id).order_by(Slot.position).all()
        coils = []
        for slot in slots:
            entry = (
                db.query(RestockEntry)
                .filter(RestockEntry.route_stop_id == stop.id, RestockEntry.slot_id == slot.id)
                .first()
            )
            product = db.query(Product).filter(Product.id == slot.product_id).first() if slot.product_id else None
            price = slot.price_override if slot.price_override is not None else (product.sell_price if product else None)
            coils.append(CoilView(
                slot_id=slot.id,
                position=slot.position,
                product_id=slot.product_id,
                product_name=product.name if product else None,
                price=float(price) if price is not None else None,
                capacity=slot.capacity,
                par_level=slot.par_level,
                current_qty_before_trip=slot.current_qty,
                current_count=entry.current_count if entry else None,
                last_filled_qty=entry.last_filled_qty if entry else None,
                filled_qty=entry.filled_qty if entry else None,
            ))

        groups[loc_key].machines.append(MachineVisit(
            route_stop_id=stop.id,
            machine_id=machine.id,
            machine_name=machine.name,
            asset_tag=machine.asset_tag,
            sequence=stop.sequence,
            status=stop.status,
            coils=coils,
        ))

    return TripDetailOut(trip=trip, locations=[groups[k] for k in order])


@router.patch("/trips/{trip_id}/start", response_model=TripOut)
def start_trip(trip_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_role("route_owner", "driver"))):
    org_id = _org_scope(current_user)
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.org_id == org_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user.role == "driver" and trip.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="This trip isn't assigned to you")
    trip.status = "in_progress"
    trip.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip


# ============================================================
# Restock submission — the core "Enter Trip Results" action
# ============================================================

@router.post("/route-stops/{route_stop_id}/restock", response_model=MachineVisit)
def submit_restock(
    route_stop_id: uuid.UUID,
    payload: RestockSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    stop = db.query(RouteStop).filter(RouteStop.id == route_stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Trip stop not found")

    trip = db.query(Trip).filter(Trip.id == stop.trip_id, Trip.org_id == org_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user.role == "driver" and trip.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="This trip isn't assigned to you")

    machine = db.query(Machine).filter(Machine.id == stop.machine_id).first()
    warehouse = db.query(Warehouse).filter(Warehouse.org_id == org_id).first()

    for item in payload.entries:
        slot = db.query(Slot).filter(Slot.id == item.slot_id, Slot.machine_id == machine.id).first()
        if not slot:
            raise HTTPException(status_code=400, detail=f"Coil {item.slot_id} does not belong to this machine")

        # Coil reassignment (product and/or price), allowed for both roles
        if item.product_id is not None:
            slot.product_id = item.product_id
        if item.price_override is not None:
            slot.price_override = item.price_override

        existing_entry = (
            db.query(RestockEntry)
            .filter(RestockEntry.route_stop_id == route_stop_id, RestockEntry.slot_id == item.slot_id)
            .first()
        )
        last_filled = existing_entry.filled_qty if existing_entry else None

        if existing_entry:
            existing_entry.current_count = item.current_count
            existing_entry.last_filled_qty = last_filled
            existing_entry.filled_qty = item.filled_qty
            existing_entry.product_id = slot.product_id
            existing_entry.price_at_restock = slot.price_override
        else:
            db.add(RestockEntry(
                org_id=org_id,
                route_stop_id=route_stop_id,
                slot_id=item.slot_id,
                product_id=slot.product_id,
                current_count=item.current_count,
                last_filled_qty=None,
                filled_qty=item.filled_qty,
                price_at_restock=slot.price_override,
                created_by=current_user.id,
            ))

        # Update live coil quantity and move inventory from warehouse to machine
        slot.current_qty = (item.current_count or 0) + item.filled_qty

        if item.filled_qty and slot.product_id:
            product = db.query(Product).filter(Product.id == slot.product_id).first()
            if product:
                product.warehouse_stock = (product.warehouse_stock or 0) - item.filled_qty

            if warehouse:
                db.add(InventoryLedger(
                    org_id=org_id,
                    entity_type="warehouse",
                    entity_id=warehouse.id,
                    product_id=slot.product_id,
                    qty_change=-item.filled_qty,
                    reason="restock_dispatch",
                    ref_doc=str(route_stop_id),
                    created_by=current_user.id,
                ))
            db.add(InventoryLedger(
                org_id=org_id,
                entity_type="machine",
                entity_id=machine.id,
                product_id=slot.product_id,
                qty_change=item.filled_qty,
                reason="restock_fill",
                ref_doc=str(route_stop_id),
                created_by=current_user.id,
            ))

    if payload.mark_completed:
        stop.status = "completed"
        stop.completed_at = datetime.now(timezone.utc)
    else:
        stop.status = "in_progress"

    db.commit()

    # Return the updated machine visit view
    slots = db.query(Slot).filter(Slot.machine_id == machine.id).order_by(Slot.position).all()
    coils = []
    for slot in slots:
        entry = (
            db.query(RestockEntry)
            .filter(RestockEntry.route_stop_id == route_stop_id, RestockEntry.slot_id == slot.id)
            .first()
        )
        product = db.query(Product).filter(Product.id == slot.product_id).first() if slot.product_id else None
        price = slot.price_override if slot.price_override is not None else (product.sell_price if product else None)
        coils.append(CoilView(
            slot_id=slot.id,
            position=slot.position,
            product_id=slot.product_id,
            product_name=product.name if product else None,
            price=float(price) if price is not None else None,
            capacity=slot.capacity,
            par_level=slot.par_level,
            current_qty_before_trip=slot.current_qty,
            current_count=entry.current_count if entry else None,
            last_filled_qty=entry.last_filled_qty if entry else None,
            filled_qty=entry.filled_qty if entry else None,
        ))

    db.refresh(stop)
    return MachineVisit(
        route_stop_id=stop.id,
        machine_id=machine.id,
        machine_name=machine.name,
        asset_tag=machine.asset_tag,
        sequence=stop.sequence,
        status=stop.status,
        coils=coils,
    )


@router.patch("/trips/{trip_id}/complete", response_model=TripOut)
def complete_trip(trip_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_role("route_owner", "driver"))):
    org_id = _org_scope(current_user)
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.org_id == org_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user.role == "driver" and trip.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="This trip isn't assigned to you")

    incomplete = db.query(RouteStop).filter(RouteStop.trip_id == trip_id, RouteStop.status != "completed").count()
    if incomplete > 0:
        raise HTTPException(status_code=400, detail=f"{incomplete} machine(s) on this trip haven't been submitted yet")

    trip.status = "completed"
    trip.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip
