import calendar
import math
from datetime import date

from sqlalchemy.orm import Session

from app.models.resource_record import ResourceRecord


def latest_measured_monthly_electricity(
    db: Session,
    workspace_id: str,
) -> dict[str, float | str] | None:
    records = (
        db.query(ResourceRecord)
        .filter(
            ResourceRecord.workspace_id == workspace_id,
            ResourceRecord.category == "electricity",
            ResourceRecord.measurement_type == "measured",
            ResourceRecord.currency == "INR",
        )
        .all()
    )
    by_month: dict[tuple[int, int], list[ResourceRecord]] = {}
    supported_units = {"kwh", "kilowatthour", "kilowatthours"}
    for record in records:
        normalized_unit = "".join(character for character in record.unit.lower() if character.isalpha())
        if normalized_unit not in supported_units:
            continue
        if not math.isfinite(record.quantity) or not math.isfinite(record.cost):
            continue
        try:
            start = date.fromisoformat(record.period_start[:10])
            end = date.fromisoformat(record.period_end[:10])
        except ValueError:
            continue
        month_end = date(start.year, start.month, calendar.monthrange(start.year, start.month)[1])
        if start.day != 1 or end != month_end:
            continue
        by_month.setdefault((start.year, start.month), []).append(record)
    if not by_month:
        return None

    latest_month = max(by_month)
    monthly_records = by_month[latest_month]
    quantity = sum(record.quantity for record in monthly_records)
    cost = sum(record.cost for record in monthly_records)
    if quantity <= 0 or cost < 0:
        return None
    return {
        "kwh": quantity,
        "cost": cost,
        "currency": "INR",
        "price_per_kwh": cost / quantity,
        "period": f"{latest_month[0]:04d}-{latest_month[1]:02d}",
    }
