"""
EcoPath.AI — Resource Records CRUD API
Full create, read, update, delete for resource consumption records.
"""
import uuid
import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from app.db.database import get_db
from app.api.auth import require_authenticated_user
from app.core.workspace_access import require_live_workspace
from app.models.resource_record import ResourceRecord
from app.models.workspace import Workspace

router = APIRouter(dependencies=[Depends(require_authenticated_user)])


# ---------- Schemas ----------

class ResourceRecordCreate(BaseModel):
    workspace_id: str
    category: str
    description: str
    quantity: float = Field(gt=0)
    unit: str
    cost: float = Field(ge=0)
    currency: str = "INR"
    period_start: str
    period_end: str
    measurement_type: str = "measured"
    source: str = ""
    notes: str = ""

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"electricity", "water", "gas", "travel", "food", "waste", "shopping", "other"}
        if v.lower() not in allowed:
            raise ValueError(f"category must be one of {allowed}")
        return v.lower()

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized != "INR":
            raise ValueError("Only INR is supported. Correct the amount to rupees before saving.")
        return normalized


class ResourceRecordUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    measurement_type: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().upper()
        if normalized != "INR":
            raise ValueError("Only INR is supported. Correct the amount to rupees before saving.")
        return normalized


# ---------- Endpoints ----------

def _require_live_workspace(db: Session, workspace_id: str) -> Workspace:
    return require_live_workspace(db, workspace_id)

@router.get("/")
def list_resources(
    workspace_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    measurement_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List resource records with optional filtering and pagination."""
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    _require_live_workspace(db, workspace_id)
    base_query = db.query(ResourceRecord).filter(ResourceRecord.workspace_id == workspace_id)
    unsupported_currency_count = base_query.filter(ResourceRecord.currency != "INR").count()
    query = base_query.filter(ResourceRecord.currency == "INR")
    if category:
        query = query.filter(ResourceRecord.category == category.lower())
    if measurement_type:
        query = query.filter(ResourceRecord.measurement_type == measurement_type)

    total = query.count()
    records = query.order_by(ResourceRecord.period_start.desc()).offset((page - 1) * size).limit(size).all()

    return {
        "items": [r.to_dict() for r in records],
        "total": total,
        "unsupported_currency_count": unsupported_currency_count,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size,
    }


@router.post("/", status_code=201)
def create_resource(payload: ResourceRecordCreate, db: Session = Depends(get_db)):
    """Create a new resource record."""
    _require_live_workspace(db, payload.workspace_id)
    record = ResourceRecord(
        id=f"res-{uuid.uuid4().hex[:8]}",
        **payload.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.get("/{record_id}")
def get_resource(record_id: str, db: Session = Depends(get_db)):
    """Get a single resource record by ID."""
    record = db.query(ResourceRecord).filter(
        ResourceRecord.id == record_id,
        ResourceRecord.currency == "INR",
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Resource record not found")
    _require_live_workspace(db, record.workspace_id)
    return record.to_dict()


@router.put("/{record_id}")
def update_resource(record_id: str, payload: ResourceRecordUpdate, db: Session = Depends(get_db)):
    """Update a resource record."""
    record = db.query(ResourceRecord).filter(ResourceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Resource record not found")
    _require_live_workspace(db, record.workspace_id)

    update_data = payload.model_dump(exclude_unset=True)
    if record.currency != "INR" and not (
        update_data.get("currency") == "INR" and update_data.get("cost") is not None
    ):
        raise HTTPException(
            status_code=400,
            detail="To correct a legacy record, provide its verified rupee amount and currency INR together.",
        )
    for key, value in update_data.items():
        setattr(record, key, value)
    record.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.delete("/{record_id}", status_code=204)
def delete_resource(record_id: str, db: Session = Depends(get_db)):
    """Delete a resource record."""
    record = db.query(ResourceRecord).filter(ResourceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Resource record not found")
    _require_live_workspace(db, record.workspace_id)
    db.delete(record)
    db.commit()
    return None


@router.post("/import/csv")
async def import_resources_csv(
    workspace_id: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Preview-validated CSV import. Required headers: category, description, quantity, unit, cost, period_start, period_end."""
    _require_live_workspace(db, workspace_id)
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")
    required = {"category", "description", "quantity", "unit", "cost", "period_start", "period_end"}
    headers = {h.strip().lower().replace(" ", "_") for h in reader.fieldnames}
    missing = required - headers
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {sorted(missing)}")

    created = []
    errors = []
    for i, row in enumerate(reader, start=2):
        norm = {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items()}
        try:
            qty = float(norm["quantity"])
            cost = float(norm["cost"])
            if qty <= 0:
                raise ValueError("quantity must be > 0")
            if cost < 0:
                raise ValueError("cost must be ≥ 0")
            payload = ResourceRecordCreate(
                workspace_id=workspace_id,
                category=norm["category"],
                description=norm["description"],
                quantity=qty,
                unit=norm["unit"],
                cost=cost,
                currency=norm.get("currency") or "INR",
                period_start=norm["period_start"],
                period_end=norm["period_end"],
                measurement_type=norm.get("measurement_type") or "imported",
                source=norm.get("source") or file.filename or "csv",
                notes=norm.get("notes") or "Imported from CSV",
            )
            record = ResourceRecord(id=f"res-{uuid.uuid4().hex[:8]}", **payload.model_dump())
            db.add(record)
            created.append(record.id)
        except Exception as exc:
            errors.append({"row": i, "error": str(exc)})
    db.commit()
    return {"created": len(created), "ids": created, "errors": errors}


@router.get("/export/csv")
def export_resources_csv(
    workspace_id: str = Query(..., description="Workspace ID to export"),
    db: Session = Depends(get_db),
):
    """Export resource records as CSV."""
    _require_live_workspace(db, workspace_id)
    records = (
        db.query(ResourceRecord)
        .filter(ResourceRecord.workspace_id == workspace_id, ResourceRecord.currency == "INR")
        .order_by(ResourceRecord.period_start)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Category", "Description", "Quantity", "Unit",
        "Cost", "Currency", "Period Start", "Period End",
        "Measurement Type", "Source", "Notes",
    ])
    for r in records:
        writer.writerow([
            r.id, r.category, r.description, r.quantity, r.unit,
            r.cost, r.currency, r.period_start, r.period_end,
            r.measurement_type, r.source, r.notes,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=resources_{workspace_id}.csv"},
    )
