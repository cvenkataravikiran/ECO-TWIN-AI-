from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from app.db.database import Base


class WorkspaceComparisonState(Base):
    __tablename__ = "workspace_comparison_states"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(
        String(64),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    state_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
