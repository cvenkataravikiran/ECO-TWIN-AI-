"""
EcoPath.AI — Workspace SQLAlchemy Model
"""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    type = Column(String(32), nullable=False)  # 'individual' | 'business'
    description = Column(Text, default="")
    is_demo = Column(Boolean, default=False)
    owner_id = Column(String(64), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    actions = relationship("Action", back_populates="workspace", cascade="all, delete-orphan")
    eco_assessments = relationship("EcoAssessment", back_populates="workspace", cascade="all, delete-orphan")
