"""
EcoPath.AI — Recommendation API Routes
Uses the deterministic rule-based recommendation engine.
"""
import calendar
import json
import math
import re
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.measured_resources import latest_measured_monthly_electricity
from app.api.auth import require_authenticated_user
from app.core.workspace_access import require_live_workspace
from app.db.database import get_db
from app.models.resource_record import ResourceRecord
from app.models.knowledge_article import KnowledgeArticle
from app.recommendation_engine.engine import UserContext, generate_recommendations, ACTIVE_RULES

router = APIRouter(dependencies=[Depends(require_authenticated_user)])


class RecommendationRequest(BaseModel):
    workspace_id: Optional[str] = None
    workspace_type: str = "individual"
    monthly_electricity_kwh: Optional[float] = None
    monthly_electricity_cost: Optional[float] = None
    monthly_grocery_spend: Optional[float] = None
    monthly_travel_km: Optional[float] = None
    travel_mode: Optional[str] = None
    monthly_waste_kg: Optional[float] = None
    monthly_water_liters: Optional[float] = None
    monthly_shopping_spend: Optional[float] = None
    price_per_kwh: float = 0.0
    currency: str = "INR"
    goals: List[str] = Field(default_factory=list)


def _latest_measured_month(
    db: Session,
    workspace_id: str,
    category: str,
    unit_conversions: Optional[dict[str, float]] = None,
) -> Optional[dict[str, float]]:
    records = (
        db.query(ResourceRecord)
        .filter(
            ResourceRecord.workspace_id == workspace_id,
            ResourceRecord.category == category,
            ResourceRecord.measurement_type == "measured",
            ResourceRecord.currency == "INR",
        )
        .all()
    )
    by_month: dict[tuple[int, int], list[tuple[ResourceRecord, float]]] = {}
    for record in records:
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
        conversion = 1.0
        if unit_conversions is not None:
            unit = re.sub(r"[^a-z]", "", record.unit.lower())
            conversion = unit_conversions.get(unit, 0.0)
            if conversion <= 0:
                continue
        by_month.setdefault((start.year, start.month), []).append((record, conversion))
    if not by_month:
        return None

    latest_month = max(by_month)
    monthly_records = by_month[latest_month]
    return {
        "quantity": sum(record.quantity * conversion for record, conversion in monthly_records),
        "cost": sum(record.cost for record, _ in monthly_records),
    }


@router.post("/generate")
def generate(payload: RecommendationRequest, db: Session = Depends(get_db)):
    """
    Generate personalized sustainability recommendations.
    Uses deterministic rules — no AI/LLM involved.
    """
    workspace_type = payload.workspace_type
    monthly_electricity_kwh = payload.monthly_electricity_kwh
    monthly_electricity_cost = payload.monthly_electricity_cost
    price_per_kwh = payload.price_per_kwh
    if payload.workspace_id:
        workspace = require_live_workspace(db, payload.workspace_id)
        workspace_type = workspace.type
        measured_electricity = latest_measured_monthly_electricity(db, payload.workspace_id)
        if measured_electricity:
            monthly_electricity_kwh = measured_electricity["kwh"]
            monthly_electricity_cost = measured_electricity["cost"]
            price_per_kwh = measured_electricity["price_per_kwh"]
        if payload.monthly_grocery_spend is None:
            food_month = _latest_measured_month(db, payload.workspace_id, "food")
            if food_month:
                payload.monthly_grocery_spend = food_month["cost"]
        if payload.monthly_water_liters is None:
            water_month = _latest_measured_month(
                db,
                payload.workspace_id,
                "water",
                {
                    "l": 1.0,
                    "liter": 1.0,
                    "litre": 1.0,
                    "liters": 1.0,
                    "litres": 1.0,
                    "kl": 1000.0,
                    "kiloliter": 1000.0,
                    "kilolitre": 1000.0,
                },
            )
            if water_month:
                payload.monthly_water_liters = water_month["quantity"]
        if payload.monthly_waste_kg is None:
            waste_month = _latest_measured_month(
                db,
                payload.workspace_id,
                "waste",
                {"kg": 1.0, "kilogram": 1.0, "kilograms": 1.0},
            )
            if waste_month:
                payload.monthly_waste_kg = waste_month["quantity"]
        if payload.monthly_travel_km is None:
            travel_month = _latest_measured_month(
                db,
                payload.workspace_id,
                "travel",
                {"km": 1.0, "kilometer": 1.0, "kilometers": 1.0, "kilometre": 1.0, "kilometres": 1.0},
            )
            if travel_month:
                payload.monthly_travel_km = travel_month["quantity"]
        if payload.monthly_shopping_spend is None:
            shopping_month = _latest_measured_month(db, payload.workspace_id, "shopping")
            if shopping_month:
                payload.monthly_shopping_spend = shopping_month["cost"]

    context = UserContext(
        workspace_type=workspace_type,
        monthly_electricity_kwh=monthly_electricity_kwh,
        monthly_electricity_cost=monthly_electricity_cost,
        monthly_grocery_spend=payload.monthly_grocery_spend,
        monthly_travel_km=payload.monthly_travel_km,
        travel_mode=payload.travel_mode,
        monthly_waste_kg=payload.monthly_waste_kg,
        monthly_water_liters=payload.monthly_water_liters,
        monthly_shopping_spend=payload.monthly_shopping_spend,
        price_per_kwh=price_per_kwh,
        goals=payload.goals,
        currency=payload.currency,
    )

    results = generate_recommendations(context)
    article_ids = {result.knowledge_article_id for result in results if result.knowledge_article_id}
    articles = (
        db.query(KnowledgeArticle)
        .filter(KnowledgeArticle.id.in_(article_ids), KnowledgeArticle.is_active.is_(True))
        .all()
    ) if article_ids else []
    articles_by_id = {article.id: article for article in articles}
    missing_article_ids = article_ids - articles_by_id.keys()
    if missing_article_ids:
        raise HTTPException(
            status_code=503,
            detail="Recommendation guidance is unavailable. Import the EcoPath.AI knowledge-base articles and retry.",
        )

    recommendation_payloads = []
    for recommendation in results:
        item = recommendation.to_dict()
        article = articles_by_id.get(recommendation.knowledge_article_id or "")
        if article:
            item["guidance_summary"] = article.summary
            item["implementation_steps"] = json.loads(article.implementation_steps or "[]")
            item["guidance_limitations"] = json.loads(article.limitations or "[]")
            item["source_references"] = [
                f"Internal guidance: {article.source_publisher or article.source_title} — {article.verification_status}"
            ]
        recommendation_payloads.append(item)

    return {
        "recommendations": recommendation_payloads,
        "total": len(recommendation_payloads),
        "engine": "deterministic-rule-based",
        "engine_version": "1.0",
        "note": "Recommendations are generated using documented rules and formulas. No generative AI is used.",
    }


@router.get("/rules")
def list_rules():
    """List all active recommendation rules with metadata."""
    return {
        "rules": ACTIVE_RULES,
        "total": len(ACTIVE_RULES),
        "note": "Each rule maps to a specific calculation module and knowledge base article.",
    }
