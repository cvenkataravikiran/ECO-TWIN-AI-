"""Thin organisation model for the demonstration business workspace."""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from app.db.database import Base


class OrgLocation(Base):
    __tablename__ = "org_locations"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    city = Column(String(64), default="Hyderabad")
    state = Column(String(64), default="Telangana")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class OrgMembership(Base):
    __tablename__ = "org_memberships"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    display_name = Column(String(128), nullable=False)
    role = Column(String(32), default="member")  # owner | member | viewer
    created_at = Column(DateTime, default=datetime.utcnow)
