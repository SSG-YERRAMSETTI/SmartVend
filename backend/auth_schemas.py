from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    org_id: Optional[UUID] = None
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: UUID
    org_id: Optional[UUID] = None
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BootstrapAdminRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class CreateOrganizationRequest(BaseModel):
    """Used by platform_admin to onboard a new business + its first Route Owner."""
    org_name: str
    owner_email: EmailStr
    owner_password: str
    owner_full_name: str


class CreateUserRequest(BaseModel):
    """Used by route_owner to create Driver accounts within their own org
    (or by platform_admin to create a route_owner directly, less common)."""
    email: EmailStr
    password: str
    full_name: str
    role: str  # 'driver' (route_owner creating) or 'route_owner' (admin creating)
