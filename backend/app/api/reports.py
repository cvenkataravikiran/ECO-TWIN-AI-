"""CSV export and PDF reports from database records."""
from __future__ import annotations

import csv
import io
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.workspace_access import require_live_workspace
from app.db.database import get_db
from app.models.action_plan import Action
from app.models.resource_record import ResourceRecord

router = APIRouter()


def _parse_report_date(value: str, field_name: str) -> date | None:
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must use YYYY-MM-DD format.") from exc
    if parsed.isoformat() != value:
        raise HTTPException(status_code=400, detail=f"{field_name} must use YYYY-MM-DD format.")
    return parsed


def _pdf_text(value: object) -> str:
    return str(value or "").encode("latin-1", "replace").decode("latin-1")


@router.get("/export/csv")
def export_csv(
    workspace_id: str = Query(...),
    type: str = Query("resources"),
    db: Session = Depends(get_db),
):
    require_live_workspace(db, workspace_id)
    output = io.StringIO()
    writer = csv.writer(output)

    if type == "resources":
        writer.writerow(["ID", "Category", "Description", "Quantity", "Unit", "Cost", "Currency", "Period Start", "Period End", "Measurement Type", "Source", "Notes", "DATA_CLASS"])
        records = db.query(ResourceRecord).filter(ResourceRecord.workspace_id == workspace_id).order_by(ResourceRecord.period_start).all()
        for r in records:
            writer.writerow([r.id, r.category, r.description, r.quantity, r.unit, r.cost, r.currency, r.period_start, r.period_end, r.measurement_type, r.source, r.notes, r.measurement_type])
    elif type == "actions":
        writer.writerow(["ID", "Title", "Category", "Status", "Planned Date", "Completed Date", "Estimate", "Actual Expenditure", "Actual Savings", "Currency", "DATA_CLASS"])
        actions = db.query(Action).filter(Action.workspace_id == workspace_id).order_by(Action.created_at).all()
        for a in actions:
            writer.writerow([a.id, a.title, a.category, a.status, a.planned_date, a.completed_date or "", a.initial_estimate_amount or "", a.actual_expenditure_amount or "", a.actual_savings_amount or "", a.initial_estimate_currency, "estimated" if a.actual_savings_amount is None else "user-reported actual"])
    elif type == "impact":
        writer.writerow(["ID", "Title", "Category", "Status", "Estimated Savings", "Actual Savings", "Currency", "NOTE"])
        actions = db.query(Action).filter(Action.workspace_id == workspace_id, Action.status.in_(["completed", "in-progress"])).all()
        for a in actions:
            writer.writerow([a.id, a.title, a.category, a.status, a.initial_estimate_amount or "", a.actual_savings_amount or "", a.initial_estimate_currency, "Do not add estimated and actual columns"])
    else:
        raise HTTPException(status_code=400, detail="Unknown export type. Use resources, actions, or impact.")

    output.seek(0)
    filename = f"ecotwin_{type}_{workspace_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/generate.pdf")
def generate_pdf(
    workspace_id: str = Query(...),
    period_start: str = Query(""),
    period_end: str = Query(""),
    db: Session = Depends(get_db),
    include_estimates: bool = Query(True),
):
    ws = require_live_workspace(db, workspace_id)
    start_date = _parse_report_date(period_start, "period_start")
    end_date = _parse_report_date(period_end, "period_end")
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="period_start must be on or before period_end.")

    try:
        from fpdf import FPDF
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="fpdf2 is not installed. pip install fpdf2") from exc

    records = db.query(ResourceRecord).filter(ResourceRecord.workspace_id == workspace_id).all()
    actions = db.query(Action).filter(Action.workspace_id == workspace_id).all()
    if start_date or end_date:
        filtered_records = []
        for record in records:
            record_start = _parse_report_date(record.period_start, "resource period_start")
            record_end = _parse_report_date(record.period_end, "resource period_end")
            if record_start is None or record_end is None:
                continue
            if start_date and record_end < start_date:
                continue
            if end_date and record_start > end_date:
                continue
            filtered_records.append(record)
        records = filtered_records

        filtered_actions = []
        for action in actions:
            action_date = _parse_report_date(
                action.completed_date or action.planned_date,
                "action date",
            )
            if action_date is None:
                continue
            if start_date and action_date < start_date:
                continue
            if end_date and action_date > end_date:
                continue
            filtered_actions.append(action)
        actions = filtered_actions

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.multi_cell(0, 8, "EcoPath.AI - Sustainability report", new_x="LMARGIN")
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, _pdf_text(f"Workspace: {ws.name} ({ws.type})"), new_x="LMARGIN")
    pdf.multi_cell(0, 6, f"Generated: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')}", new_x="LMARGIN")
    pdf.multi_cell(0, 6, f"Period filter: {period_start or 'any'} to {period_end or 'any'}", new_x="LMARGIN")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Resource records", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    if not records:
        pdf.multi_cell(0, 5, "No resource records in this period.", new_x="LMARGIN")
    for r in records:
        line = f"{r.period_start} {r.category} {r.description}: {r.quantity} {r.unit}, {r.currency} {r.cost} [{r.measurement_type}]"
        pdf.multi_cell(0, 5, _pdf_text(line), new_x="LMARGIN")
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Actions (planned and completed)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    if not actions:
        pdf.multi_cell(0, 5, "No actions in this period.", new_x="LMARGIN")
    for a in actions:
        action_date = a.completed_date or a.planned_date
        estimate = f"planned estimate={a.initial_estimate_amount} {a.initial_estimate_currency}" if include_estimates and a.initial_estimate_amount is not None else "planned estimate=not included"
        actual = f"user-reported actual savings={a.actual_savings_amount} {a.initial_estimate_currency}" if a.actual_savings_amount is not None else "user-reported actual savings=not provided"
        line = f"{action_date} | {a.status} | {a.title} | {estimate} | {actual}"
        pdf.multi_cell(0, 5, _pdf_text(line), new_x="LMARGIN")
    pdf.ln(3)
    pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(
        0,
        5,
        "Assumptions: costs use user-entered INR amounts. Electricity CO2 is omitted unless a CEA Combined Margin is configured. Estimates are never counted as actuals. This is not a certified carbon inventory.",
        new_x="LMARGIN",
    )

    buf = io.BytesIO(pdf.output())
    buf.seek(0)
    filename = f"ecotwin_sustainability_{workspace_id}_{period_start or 'all'}_{period_end or 'all'}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/generate")
def generate_report_alias(workspace_id: str = Query(...), db: Session = Depends(get_db)):
    require_live_workspace(db, workspace_id)
    return {
        "status": "use GET /api/reports/generate.pdf",
        "url": f"/api/reports/generate.pdf?workspace_id={workspace_id}",
    }
