"""
EcoPath.AI — Impact Ledger API Routes
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.workspace_access import require_live_workspace
from app.api.auth import require_authenticated_user
from app.db.database import get_db
from app.models.action_plan import Action

router = APIRouter(dependencies=[Depends(require_authenticated_user)])


@router.get("/")
def list_impact_entries(
    workspace_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List in-progress or completed actions and any user-reported financial results.
    This endpoint does not calculate environmental impact or estimated savings.
    """
    if not workspace_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="workspace_id is required")
    require_live_workspace(db, workspace_id)
    query = db.query(Action)
    if workspace_id:
        query = query.filter(Action.workspace_id == workspace_id)
    if status:
        query = query.filter(Action.status == status)
    else:
        # Default: show completed and in-progress actions that have impact data
        query = query.filter(Action.status.in_(["completed", "in-progress"]))

    actions = query.order_by(Action.updated_at.desc()).all()

    entries = []
    for a in actions:
        entries.append({
            "id": a.id,
            "title": a.title,
            "category": a.category,
            "status": a.status,
            "planned_date": a.planned_date,
            "completed_date": a.completed_date,
            "estimated_value": None,
            "actual_value": a.actual_savings_amount,
            "actual_expenditure": a.actual_expenditure_amount,
            "currency": a.initial_estimate_currency,
            "data_source": "user-reported" if a.actual_savings_amount is not None else "not-reported",
            "notes": a.notes or "",
        })

    return {
        "items": entries,
        "total": len(entries),
        "summary": {
            "completed": sum(1 for e in entries if e["status"] == "completed"),
            "verified": sum(1 for e in entries if e["actual_value"] is not None),
            "total_estimated_savings": None,
            "total_actual_savings": round(
                sum((e["actual_value"] or 0) for e in entries if e["actual_value"] is not None), 2
            ),
            "note": "Estimated and actual savings are never added together.",
        },
    }
