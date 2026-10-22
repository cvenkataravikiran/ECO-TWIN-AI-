"""
EcoPath.AI — Resource Record SQLAlchemy Model
Stores physical and financial resource consumption entries.
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, String, Float, DateTime, Text
from app.db.database import Base


class ResourceRecord(Base):
    __tablename__ = "resource_records"

    id = Column(String(64), primary_key=True, default=lambda: f"res-{uuid.uuid4().hex[:8]}")
    workspace_id = Column(String(64), nullable=False, index=True)
    category = Column(String(32), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    cost = Column(Float, nullable=False)
    currency = Column(String(16), default="INR")
    period_start = Column(String(32), nullable=False)
    period_end = Column(String(32), nullable=False)
    measurement_type = Column(String(32), default="measured")
    source = Column(String(255), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        created_str = self.created_at.isoformat() if isinstance(self.created_at, datetime) else str(self.created_at or "")
        updated_str = self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else str(self.updated_at or "")

        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "workspaceId": self.workspace_id,
            "category": self.category,
            "description": self.description,
            "quantity": float(self.quantity),
            "unit": self.unit,
            "cost": float(self.cost),
            "currency": self.currency,
            "period_start": self.period_start,
            "periodStart": self.period_start,
            "period_end": self.period_end,
            "periodEnd": self.period_end,
            "measurement_type": self.measurement_type,
            "measurementType": self.measurement_type,
            "source": self.source or "",
            "notes": self.notes or "",
            "created_at": created_str,
            "createdAt": created_str,
            "updated_at": updated_str,
            "updatedAt": updated_str,
        }
