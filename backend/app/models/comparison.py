from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base


class SavedComparison(Base):
    __tablename__ = "saved_comparisons"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    scenario = Column(String(64), nullable=False)
    title = Column(String(255), default="")
    inputs_json = Column(Text, nullable=False)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace")
