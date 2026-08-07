from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime, date


class MileageLogCreate(BaseModel):
    driver_id: Optional[UUID] = None
    trip_id: Optional[UUID] = None
    log_date: date
    start_odometer: Optional[float] = None
    end_odometer: Optional[float] = None
    miles: float
    notes: Optional[str] = None


class MileageLogOut(BaseModel):
    id: UUID
    org_id: UUID
    driver_id: Optional[UUID] = None
    trip_id: Optional[UUID] = None
    log_date: date
    start_odometer: Optional[float] = None
    end_odometer: Optional[float] = None
    miles: float
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    expense_date: date
    category: str
    vendor_name: Optional[str] = None
    amount: float
    notes: Optional[str] = None
    trip_id: Optional[UUID] = None


class ExpenseOut(BaseModel):
    id: UUID
    org_id: UUID
    expense_date: date
    category: str
    vendor_name: Optional[str] = None
    amount: float
    notes: Optional[str] = None
    photo_path: Optional[str] = None
    receipt_id: Optional[UUID] = None
    trip_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProfitByRangeOut(BaseModel):
    date_from: date
    date_to: date
    revenue: float
    total_expenses: float
    profit: float
    expense_breakdown: list[dict]


class RouteOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    frequency: str
    assigned_driver_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardLayoutUpdate(BaseModel):
    widgets: list[str]  # ordered list of enabled widget ids
