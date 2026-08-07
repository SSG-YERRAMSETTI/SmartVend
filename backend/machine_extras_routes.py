import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from auth import get_db, get_current_user, require_role
from models import User, Machine, MachinePhoto, MachineAttachment, Ticket
from domain_schemas import (
    MachinePhotoOut, MachineAttachmentOut, TicketCreate, TicketUpdate, TicketOut,
)

router = APIRouter(tags=["machine-extras"])

MACHINE_UPLOAD_DIR = Path("uploads/machines")


def _org_scope(current_user: User):
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data to access here")
    return current_user.org_id


def _get_machine(db: Session, org_id, machine_id: uuid.UUID) -> Machine:
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.org_id == org_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return machine


# ============================================================
# Photos
# ============================================================

@router.get("/machines/{machine_id}/photos", response_model=list[MachinePhotoOut])
def list_photos(machine_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    _get_machine(db, org_id, machine_id)
    return db.query(MachinePhoto).filter(MachinePhoto.machine_id == machine_id).order_by(MachinePhoto.taken_at.desc()).all()


@router.post("/machines/{machine_id}/photos", response_model=MachinePhotoOut)
def upload_photo(
    machine_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    _get_machine(db, org_id, machine_id)

    machine_dir = MACHINE_UPLOAD_DIR / str(machine_id) / "photos"
    machine_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest_path = machine_dir / safe_name
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    photo = MachinePhoto(machine_id=machine_id, file_path=str(dest_path), created_by=current_user.id)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


# ============================================================
# Attachments
# ============================================================

@router.get("/machines/{machine_id}/attachments", response_model=list[MachineAttachmentOut])
def list_attachments(machine_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_scope(current_user)
    _get_machine(db, org_id, machine_id)
    return db.query(MachineAttachment).filter(MachineAttachment.machine_id == machine_id).order_by(MachineAttachment.created_at.desc()).all()


@router.post("/machines/{machine_id}/attachments", response_model=MachineAttachmentOut)
def upload_attachment(
    machine_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    _get_machine(db, org_id, machine_id)

    machine_dir = MACHINE_UPLOAD_DIR / str(machine_id) / "attachments"
    machine_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest_path = machine_dir / safe_name
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    attachment = MachineAttachment(
        machine_id=machine_id, file_path=str(dest_path), filename=file.filename, created_by=current_user.id
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


# ============================================================
# Tickets — used for both "Maintenance" (create) and "Service History" (list)
# ============================================================

@router.get("/tickets", response_model=list[TicketOut])
def list_tickets(
    machine_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _org_scope(current_user)
    q = db.query(Ticket).filter(Ticket.org_id == org_id)
    if machine_id:
        q = q.filter(Ticket.machine_id == machine_id)
    return q.order_by(Ticket.created_at.desc()).all()


@router.post("/tickets", response_model=TicketOut)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    if payload.machine_id:
        _get_machine(db, org_id, payload.machine_id)
    ticket = Ticket(org_id=org_id, created_by=current_user.id, **payload.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: uuid.UUID,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("route_owner", "driver")),
):
    org_id = _org_scope(current_user)
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.org_id == org_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)
    ticket.updated_by = current_user.id
    db.commit()
    db.refresh(ticket)
    return ticket
