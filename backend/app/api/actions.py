"""
EcoTwin AI — Actions (Action Plan) CRUD API
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator

from app.db.database import get_db
from app.core.workspace_access import require_live_workspace
from app.models.action_plan import Action

router = APIRouter()


class ActionCreate(BaseModel):
    workspace_id: str
    recommendation_id: Optional[str] = None
    title: str
    category: str
    status: str = "planned"
    planned_date: str
    initial_estimate_amount: Optional[float] = None
    initial_estimate_currency: str = "INR"
    notes: Optional[str] = None

    @field_validator("initial_estimate_currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized != "INR":
            raise ValueError("Only INR is supported for monetary action values.")
        return normalized


class ActionUpdate(BaseModel):
    status: Optional[str] = None
    completed_date: Optional[str] = None
    actual_expenditure_amount: Optional[float] = None
    actual_savings_amount: Optional[float] = None
    notes: Optional[str] = None


def _action_dict(a: Action) -> dict:
    return {
        "id": a.id,
        "workspace_id": a.workspace_id,
        "recommendation_id": a.recommendation_id,
        "title": a.title,
        "category": a.category,
        "status": a.status,
        "planned_date": a.planned_date,
        "completed_date": a.completed_date,
        "initial_estimate_amount": a.initial_estimate_amount,
        "initial_estimate_currency": a.initial_estimate_currency,
        "actual_expenditure_amount": a.actual_expenditure_amount,
        "actual_savings_amount": a.actual_savings_amount,
        "notes": a.notes or "",
        "created_at": a.created_at.isoformat() if a.created_at else "",
        "updated_at": a.updated_at.isoformat() if a.updated_at else "",
    }


@router.get("/")
def list_actions(
    workspace_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List actions with optional workspace and status filters."""
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    require_live_workspace(db, workspace_id)
    query = db.query(Action)
    if workspace_id:
        query = query.filter(Action.workspace_id == workspace_id)
    if status:
        query = query.filter(Action.status == status)

    actions = query.order_by(Action.created_at.desc()).all()
    return {"items": [_action_dict(a) for a in actions], "total": len(actions)}


@router.post("/", status_code=201)
def create_action(payload: ActionCreate, db: Session = Depends(get_db)):
    """Create a new action."""
    require_live_workspace(db, payload.workspace_id)
    action = Action(id=f"act-{uuid.uuid4().hex[:8]}", **payload.model_dump())
    db.add(action)
    db.commit()
    db.refresh(action)
    return _action_dict(action)


@router.get("/{action_id}")
def get_action(action_id: str, db: Session = Depends(get_db)):
    """Get an action by ID."""
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    require_live_workspace(db, action.workspace_id)
    return _action_dict(action)


@router.put("/{action_id}")
def update_action(action_id: str, payload: ActionUpdate, db: Session = Depends(get_db)):
    """Update an action's status, results, or notes."""
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    require_live_workspace(db, action.workspace_id)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(action, key, value)
    action.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(action)
    return _action_dict(action)


@router.delete("/{action_id}", status_code=204)
def delete_action(action_id: str, db: Session = Depends(get_db)):
    """Delete an action."""
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    require_live_workspace(db, action.workspace_id)
    db.delete(action)
    db.commit()
    return None
