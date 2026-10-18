from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.workspace import Workspace


def require_live_workspace(db: Session, workspace_id: str) -> Workspace:
    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.id == workspace_id,
            Workspace.is_demo.is_(False),
        )
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace
