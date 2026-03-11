from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class Category(Base):
    __tablename__ = "categories"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False, unique=True)
    icon       = Column(String, default="💰")        # emoji icon
    color      = Column(String, default="#6366f1")   # hex color for charts
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    id             = Column(Integer, primary_key=True, index=True)
    description    = Column(String, nullable=False)          # antes: store
    date           = Column(String, nullable=False)          # YYYY-MM-DD
    total          = Column(Float, nullable=False, default=0)
    currency       = Column(String, default="COP")
    payment_method = Column(String, default="Efectivo")
    category       = Column(String, default="Otro")
    type           = Column(String, default="gasto")         # "gasto" | "ingreso"
    notes          = Column(String, default="")
    saved_at       = Column(DateTime(timezone=True), server_default=func.now())
