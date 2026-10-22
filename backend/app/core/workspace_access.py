from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.workspace import Workspace


def require_live_workspace(db: Session, workspace_id: str) -> Workspace:
    filters = [
        Workspace.id == workspace_id,
        Workspace.is_demo.is_(False),
    ]
    owner_id = db.info.get("authenticated_user_id")
    if owner_id:
        filters.append(Workspace.owner_id == owner_id)
    workspace = db.query(Workspace).filter(*filters).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace
