import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_db, get_current_user, require_role
from models import User, Product, Location, Machine, InventoryBatch, Warehouse
from domain_schemas import (
    ProductCreate, ProductUpdate, ProductOut,
    LocationCreate, LocationUpdate, LocationOut,
    MachineCreate, MachineUpdate, MachineOut,
)

router = APIRouter(tags=["domain"])


def _org_scope(current_user: User):
    """platform_admin has no org_id and should not read/write tenant business
    data through these endpoints — that's intentionally out of scope for them."""
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data to access here")
    return current_user.org_id


# ============================================================
# Products
# ============================================================

@router.get("/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    return db.query(Product).filter(Product.org_id == org_id).order_by(Product.name).all()


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    product = db.query(Product).filter(Product.id == product_id, Product.org_id == org_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    existing = db.query(Product).filter(Product.org_id == org_id, Product.sku == payload.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A product with code/SKU '{payload.sku}' already exists")

    data = payload.model_dump(exclude={"initial_quantity", "initial_unit_cost"})
    product = Product(org_id=org_id, warehouse_stock=payload.initial_quantity or 0, created_by=current_user.id, **data)
    db.add(product)
    db.flush()

    # "Initial Inventory Setup" from the Create Product screen creates the first warehouse batch
    if payload.initial_quantity and payload.initial_quantity > 0:
        warehouse = db.query(Warehouse).filter(Warehouse.org_id == org_id).first()
        if warehouse:
            batch = InventoryBatch(
                org_id=org_id,
                product_id=product.id,
                location_type="warehouse",
                location_id=warehouse.id,
                batch_number="INITIAL",
                quantity=payload.initial_quantity,
                unit_cost=payload.initial_unit_cost or payload.cost_price,
            )
            db.add(batch)

    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    product = db.query(Product).filter(Product.id == product_id, Product.org_id == org_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    product.updated_by = current_user.id
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}")
def delete_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    product = db.query(Product).filter(Product.id == product_id, Product.org_id == org_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"status": "deleted"}


# ============================================================
# Locations
# ============================================================

@router.get("/locations", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    return db.query(Location).filter(Location.org_id == org_id).order_by(Location.name).all()


@router.get("/locations/{location_id}", response_model=LocationOut)
def get_location(location_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    location = db.query(Location).filter(Location.id == location_id, Location.org_id == org_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("/locations", response_model=LocationOut)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    location = Location(org_id=org_id, **payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.patch("/locations/{location_id}", response_model=LocationOut)
def update_location(
    location_id: uuid.UUID,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    location = db.query(Location).filter(Location.id == location_id, Location.org_id == org_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(location, field, value)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/locations/{location_id}")
def delete_location(
    location_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    location = db.query(Location).filter(Location.id == location_id, Location.org_id == org_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(location)
    db.commit()
    return {"status": "deleted"}


# ============================================================
# Machines
# ============================================================

@router.get("/machines", response_model=list[MachineOut])
def list_machines(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    return db.query(Machine).filter(Machine.org_id == org_id).order_by(Machine.name).all()


@router.get("/machines/{machine_id}", response_model=MachineOut)
def get_machine(machine_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.org_id == org_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return machine


@router.post("/machines", response_model=MachineOut)
def create_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    existing = db.query(Machine).filter(Machine.org_id == org_id, Machine.asset_tag == payload.asset_tag).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A machine with asset tag '{payload.asset_tag}' already exists")

    if payload.location_id:
        loc = db.query(Location).filter(Location.id == payload.location_id, Location.org_id == org_id).first()
        if not loc:
            raise HTTPException(status_code=400, detail="location_id does not belong to your organization")

    machine = Machine(org_id=org_id, created_by=current_user.id, **payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.patch("/machines/{machine_id}", response_model=MachineOut)
def update_machine(
    machine_id: uuid.UUID,
    payload: MachineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.org_id == org_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(machine, field, value)
    machine.updated_by = current_user.id
    db.commit()
    db.refresh(machine)
    return machine


@router.delete("/machines/{machine_id}")
def delete_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner")),
):
    org_id = _org_scope(current_user)
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.org_id == org_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    db.delete(machine)
    db.commit()
    return {"status": "deleted"}
