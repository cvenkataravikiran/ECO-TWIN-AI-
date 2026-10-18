from app.db.database import Base
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid


class EcoAssessment(Base):
    __tablename__ = "eco_assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    image_filename = Column(String(255), nullable=False)
    model_id = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False)
    processing_time_ms = Column(Integer, nullable=False)
    score_value = Column(Float, nullable=True)
    score_max = Column(Float, nullable=True)
    evidence_coverage = Column(Float, nullable=True)  # 0.0 to 1.0
    is_reliable = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    image_retained = Column(Boolean, default=False, nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="eco_assessments")
    observations = relationship(
        "VisualObservation",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<EcoAssessment id={self.id} score={self.score_value}/{self.score_max} reliable={self.is_reliable}>"


class VisualObservation(Base):
    __tablename__ = "visual_observations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String(36), ForeignKey("eco_assessments.id"), nullable=False, index=True)
    class_label = Column(String(100), nullable=False)
    sustainability_category = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, nullable=False)
    bbox_y = Column(Float, nullable=False)
    bbox_w = Column(Float, nullable=False)
    bbox_h = Column(Float, nullable=False)
    status = Column(String(20), default="detected", nullable=False)  # detected, confirmed, corrected, dismissed
    user_label = Column(String(100), nullable=True)
    user_notes = Column(Text, nullable=True)

    # Relationship
    assessment = relationship("EcoAssessment", back_populates="observations")

    def __repr__(self) -> str:
        return f"<VisualObservation id={self.id} label='{self.class_label}' conf={self.confidence:.2f}>"
