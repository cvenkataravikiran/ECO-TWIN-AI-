"""Workspace routes backed by the workspaces table."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import OrgLocation, OrgMembership, ResourceRecord, SavedComparison
from app.models.workspace import Workspace

router = APIRouter()


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    type: str = "individual"
    description: str = Field(default="", max_length=2000)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value not in {"individual", "business"}:
            raise ValueError("type must be individual or business")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Workspace name is required")
        return value


def _to_dict(ws: Workspace) -> dict:
    return {
        "id": ws.id,
        "name": ws.name,
        "type": ws.type,
        "description": ws.description or "",
        "is_demo": bool(ws.is_demo),
        "isDemo": bool(ws.is_demo),
        "created_at": ws.created_at.isoformat() if ws.created_at else "",
        "createdAt": ws.created_at.isoformat() if ws.created_at else "",
    }


@router.get("/")
def list_workspaces(db: Session = Depends(get_db)):
    rows = (
        db.query(Workspace)
        .filter(Workspace.is_demo.is_(False))
        .order_by(Workspace.created_at)
        .all()
    )
    return [_to_dict(w) for w in rows]


@router.post("/", status_code=201)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    workspace = Workspace(
        id=f"ws-{uuid.uuid4().hex[:12]}",
        name=payload.name,
        type=payload.type,
        description=payload.description.strip(),
        is_demo=False,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return _to_dict(workspace)


@router.get("/{workspace_id}")
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.is_demo:
        raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found")
    return _to_dict(ws)


@router.put("/{workspace_id}")
def update_workspace(workspace_id: str, payload: WorkspaceUpdate, db: Session = Depends(get_db)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.is_demo:
        raise HTTPException(status_code=404, detail="Workspace not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(ws, key, value)
    db.commit()
    db.refresh(ws)
    return _to_dict(ws)


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.is_demo:
        raise HTTPException(status_code=404, detail="Workspace not found")

    db.query(ResourceRecord).filter(ResourceRecord.workspace_id == workspace_id).delete(
        synchronize_session=False,
    )
    db.query(SavedComparison).filter(SavedComparison.workspace_id == workspace_id).delete(
        synchronize_session=False,
    )
    db.query(OrgLocation).filter(OrgLocation.workspace_id == workspace_id).delete(
        synchronize_session=False,
    )
    db.query(OrgMembership).filter(OrgMembership.workspace_id == workspace_id).delete(
        synchronize_session=False,
    )
    db.delete(ws)
    db.commit()
    return {"deleted": True, "workspace_id": workspace_id}
