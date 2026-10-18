from app.db.database import Base
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid


class Action(Base):
    __tablename__ = "actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    recommendation_id = Column(String(100), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="planned", nullable=False)  # suggested, planned, in-progress, completed, deferred
    planned_date = Column(String(10), nullable=False)
    completed_date = Column(String(10), nullable=True)
    initial_estimate_amount = Column(Float, nullable=True)
    initial_estimate_currency = Column(String(3), default="INR", nullable=False)
    actual_expenditure_amount = Column(Float, nullable=True)
    actual_savings_amount = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    workspace = relationship("Workspace", back_populates="actions")

    def __repr__(self) -> str:
        return f"<Action id={self.id} title='{self.title[:30]}' status='{self.status}'>"
