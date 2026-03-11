from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Categories ────────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str
    icon: str = "💰"
    color: str = "#6366f1"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    color: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Transactions ──────────────────────────────────────────────
class TransactionCreate(BaseModel):
    description: str
    date: str
    total: float
    currency: str = "COP"
    payment_method: str = "Efectivo"
    category: str = "Otro"
    type: str = "gasto"  # "gasto" | "ingreso"
    notes: str = ""


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    date: Optional[str] = None
    total: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None


class TransactionOut(BaseModel):
    id: int
    description: str
    date: str
    total: float
    currency: str
    payment_method: str
    category: str
    type: str
    notes: Optional[str] = ""
    saved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
