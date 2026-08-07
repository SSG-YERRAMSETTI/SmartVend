from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from db import SessionLocal
from models import User, Organization, Warehouse
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role, get_db,
)
from auth_schemas import (
    LoginRequest, TokenResponse, UserOut,
    BootstrapAdminRequest, CreateOrganizationRequest, CreateUserRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/bootstrap-admin", response_model=TokenResponse)
def bootstrap_admin(payload: BootstrapAdminRequest, db: Session = Depends(get_db)):
    """One-time setup: creates the single Platform Admin account.
    Refuses if a platform_admin already exists, so this can't be abused later."""
    existing_admin = db.query(User).filter(User.role == "platform_admin").first()
    if existing_admin:
        raise HTTPException(
            status_code=403,
            detail="A platform admin already exists. Use /auth/login instead.",
        )

    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    admin = User(
        org_id=None,
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="platform_admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = create_access_token(admin)
    return TokenResponse(access_token=token, role=admin.role, org_id=admin.org_id, full_name=admin.full_name)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    token = create_access_token(user)
    return TokenResponse(access_token=token, role=user.role, org_id=user.org_id, full_name=user.full_name)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/organizations", response_model=UserOut)
def create_organization(
    payload: CreateOrganizationRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("platform_admin")),
):
    """Platform Admin onboards a new business (tenant) and its first Route Owner."""
    existing_email = db.query(User).filter(User.email == payload.owner_email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Owner email already registered")

    org = Organization(name=payload.org_name)
    db.add(org)
    db.flush()  # get org.id before creating the owner

    # Every organization gets one default warehouse automatically — this is
    # where initial product inventory lands until a real warehouses module
    # (multiple warehouses, transfers) is built out.
    default_warehouse = Warehouse(org_id=org.id, name="Main Warehouse", address="")
    db.add(default_warehouse)

    owner = User(
        org_id=org.id,
        email=payload.owner_email,
        password_hash=hash_password(payload.owner_password),
        full_name=payload.owner_full_name,
        role="route_owner",
        created_by=_admin.id,
        is_active=True,
    )
    db.add(owner)
    db.commit()
    db.refresh(owner)
    return owner


@router.post("/users", response_model=UserOut)
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("platform_admin", "route_owner")),
):
    """Route Owner creates Driver accounts within their own org.
    Platform Admin may create a route_owner directly (rare; prefer /organizations)."""
    if current_user.role == "route_owner" and payload.role != "driver":
        raise HTTPException(status_code=403, detail="Route owners can only create driver accounts")
    if current_user.role == "platform_admin" and payload.role not in ("route_owner", "driver"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if current_user.role == "platform_admin" and payload.role == "route_owner":
        raise HTTPException(
            status_code=400,
            detail="Use POST /auth/organizations to create a route owner (it also creates their organization)",
        )

    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        org_id=current_user.org_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        created_by=current_user.id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/users", response_model=list[UserOut])
def list_org_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("platform_admin", "route_owner")),
):
    """Route owners see users in their own org; platform admin sees everyone."""
    q = db.query(User)
    if current_user.role == "route_owner":
        q = q.filter(User.org_id == current_user.org_id)
    return q.order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("platform_admin", "route_owner")),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role == "route_owner" and target.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Cannot manage users outside your organization")
    target.is_active = False
    db.commit()
    db.refresh(target)
    return target
