"""Comparison calculations in INR with user-supplied tariffs. No invented CEA factor."""
from __future__ import annotations

import json
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.calculations.energy import estimate_led_savings
from app.api.auth import require_authenticated_user
from app.core.workspace_access import require_live_workspace
from app.core.factors import electricity_emissions_kg
from app.db.database import get_db
from app.models.comparison import SavedComparison

router = APIRouter(dependencies=[Depends(require_authenticated_user)])


class ComparisonInput(BaseModel):
    scenario: str
    inputs: Dict[str, Any]
    workspace_id: Optional[str] = None
    save: bool = False
    title: str = ""


@router.post("/calculate")
def calculate_comparison(payload: ComparisonInput, db: Session = Depends(get_db)):
    scenario = payload.scenario.lower()
    inputs = payload.inputs
    if scenario == "lighting":
        result = _calc_lighting(inputs)
    elif scenario == "commute":
        result = _calc_commute(inputs)
    elif scenario == "containers":
        result = _calc_containers(inputs)
    elif scenario == "water":
        result = _calc_water(inputs)
    elif scenario == "repair":
        result = _calc_repair(inputs)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unknown scenario. Use lighting, commute, containers, water, or repair.",
        )

    if payload.save:
        if result.get("calculated") is False:
            raise HTTPException(status_code=422, detail="Complete the required inputs before saving a comparison.")
        if not payload.workspace_id:
            raise HTTPException(status_code=400, detail="workspace_id required to save")
        require_live_workspace(db, payload.workspace_id)
        rec = SavedComparison(
            id=f"cmp-{uuid.uuid4().hex[:8]}",
            workspace_id=payload.workspace_id,
            scenario=scenario,
            title=payload.title or scenario,
            inputs_json=json.dumps(inputs),
            result_json=json.dumps(result),
        )
        db.add(rec)
        db.commit()
        result["saved_id"] = rec.id
    return result


@router.get("/")
def list_comparisons(workspace_id: str = Query(...), db: Session = Depends(get_db)):
    require_live_workspace(db, workspace_id)
    rows = (
        db.query(SavedComparison)
        .filter(SavedComparison.workspace_id == workspace_id)
        .order_by(SavedComparison.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": r.id,
                "scenario": r.scenario,
                "title": r.title,
                "inputs": json.loads(r.inputs_json),
                "result": json.loads(r.result_json),
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ],
        "total": len(rows),
    }


def _calc_lighting(inputs: dict) -> dict:
    required = ("num_bulbs", "hours_per_day", "price_per_kwh")
    missing = [name for name in required if inputs.get(name) in (None, "")]
    if missing:
        return {
            "scenario": "lighting",
            "currency": "INR",
            "calculated": False,
            "missing": missing,
            "note": "Enter the measured lamp count, daily operating hours, and ₹/kWh from your electricity bill.",
        }

    num_bulbs = int(inputs["num_bulbs"])
    hours = float(inputs["hours_per_day"])
    price = inputs.get("price_per_kwh")
    price = float(price)
    if num_bulbs < 0 or not 0 <= hours <= 24 or price < 0:
        raise HTTPException(status_code=422, detail="Lamp count, daily hours, or tariff is outside the supported range.")
    grid_override = inputs.get("grid_kg_co2e_per_kwh")
    options = []
    for name, wattage in [("Incandescent", 60.0), ("CFL", 14.0), ("LED", 9.0)]:
        annual_kwh = round(num_bulbs * wattage * hours * 365 / 1000, 2)
        annual_cost = round(annual_kwh * price, 2)
        monthly_cost = round(annual_cost / 12, 2)
        emissions = electricity_emissions_kg(annual_kwh, float(grid_override) if grid_override not in (None, "") else None)
        options.append(
            {
                "name": name,
                "wattage": wattage,
                "monthly_cost": monthly_cost,
                "annual_cost": annual_cost,
                "annual_kwh": annual_kwh,
                "estimated_co2_kg": emissions["value"],
                "emissions_note": emissions["note"],
            }
        )
    led_bulb_price = inputs.get("led_bulb_price")
    led = estimate_led_savings(
        num_bulbs,
        60.0,
        9.0,
        hours,
        price,
        cost_per_bulb=float(led_bulb_price) if led_bulb_price not in (None, "") else None,
    )
    return {
        "scenario": "lighting",
        "currency": "INR",
        "options": options,
        "led_vs_incandescent": led,
        "formula": "annual_cost_INR = num_bulbs × wattage × hours/day × 365 / 1000 × ₹/kWh",
        "assumptions": [
            f"All {num_bulbs} lamps operate {hours} hours/day, 365 days/year.",
            f"Electricity price: ₹{price}/kWh (user-entered).",
            "Grid CO₂ is omitted unless a validated CEA Combined Margin is supplied.",
        ],
        "note": "Modelled estimate. Not a measured reduction.",
    }


def _calc_commute(inputs: dict) -> dict:
    required = ("distance_km", "days_per_week")
    missing = [name for name in required if inputs.get(name) in (None, "")]
    if missing:
        return {
            "scenario": "commute",
            "currency": "INR",
            "calculated": False,
            "missing": missing,
            "note": "Enter your usual round-trip distance and travel days per week. No commute is assumed.",
        }
    distance_km = float(inputs["distance_km"])
    days = float(inputs["days_per_week"])
    if distance_km < 0 or not 0 <= days <= 7:
        raise HTTPException(status_code=422, detail="Distance or commute days are outside the supported range.")
    monthly_trips = days * 4.33
    monthly_km = round(distance_km * monthly_trips, 2)

    def cost_option(name: str, monthly_cost: Optional[float], note: str) -> dict:
        return {
            "name": name,
            "monthly_km": monthly_km,
            "monthly_cost": monthly_cost,
            "annual_cost": None if monthly_cost is None else round(monthly_cost * 12, 2),
            "note": note,
        }

    options = [
        cost_option(
            "Walk",
            float(inputs["walk_monthly"]) if inputs.get("walk_monthly") not in (None, "") else None,
            "Enter any monthly cost you want included; feasibility is not assessed.",
        ),
        cost_option(
            "Cycle",
            float(inputs["bike_maintenance_monthly"]) if inputs.get("bike_maintenance_monthly") not in (None, "") else None,
            "Enter actual monthly upkeep in ₹; no zero-cost assumption is applied.",
        ),
        cost_option(
            "City bus",
            float(inputs["bus_monthly"]) if inputs.get("bus_monthly") not in (None, "") else None,
            "Enter your actual monthly bus spend. No TSRTC table is stored.",
        ),
        cost_option(
            "Metro",
            float(inputs["metro_monthly"]) if inputs.get("metro_monthly") not in (None, "") else None,
            "Enter your Metro pass or typical monthly tokens in ₹.",
        ),
        cost_option(
            "Train",
            float(inputs["train_monthly"]) if inputs.get("train_monthly") not in (None, "") else None,
            "Enter suburban/rail spend in ₹.",
        ),
        cost_option(
            "Carpool (your share)",
            float(inputs["carpool_monthly"]) if inputs.get("carpool_monthly") not in (None, "") else None,
            "Enter your share of fuel in ₹.",
        ),
        cost_option(
            "Two-wheeler",
            float(inputs["twowheeler_monthly"]) if inputs.get("twowheeler_monthly") not in (None, "") else None,
            "Enter fuel and typical servicing in ₹.",
        ),
        cost_option(
            "Car",
            float(inputs["car_monthly"]) if inputs.get("car_monthly") not in (None, "") else (
                round(monthly_km * float(inputs["car_cost_per_km"]), 2) if inputs.get("car_cost_per_km") not in (None, "") else None
            ),
            "Enter monthly fuel or ₹/km from your own records.",
        ),
    ]
    return {
        "scenario": "commute",
        "currency": "INR",
        "calculated": True,
        "monthly_km": monthly_km,
        "options": options,
        "formula": "monthly_km = distance_km × days/week × 4.33",
        "assumptions": [
            f"Trip distance {distance_km} km, {days} days/week.",
            "Passenger-km emission factors are not hardcoded. Cost uses your rupee inputs only.",
        ],
        "note": "Whether Metro or bus is realistic for your door-to-door trip is not verified by the app.",
    }


def _calc_containers(inputs: dict) -> dict:
    required = (
        "uses_per_week",
        "disposable_cost_per_unit",
        "reusable_cost",
        "reusable_lifespan_uses",
        "wash_cost_per_use",
    )
    missing = [name for name in required if inputs.get(name) in (None, "")]
    if missing:
        return {
            "scenario": "containers",
            "currency": "INR",
            "calculated": False,
            "missing": missing,
            "note": "Enter your actual item prices, use frequency, reusable lifespan and washing cost per use.",
        }
    uses_per_week = float(inputs["uses_per_week"])
    disposable_cost = float(inputs["disposable_cost_per_unit"])
    reusable_cost = float(inputs["reusable_cost"])
    reusable_lifespan_uses = int(inputs["reusable_lifespan_uses"])
    wash_cost_per_use = float(inputs["wash_cost_per_use"])
    if uses_per_week < 0 or disposable_cost < 0 or reusable_cost < 0 or reusable_lifespan_uses <= 0 or wash_cost_per_use < 0:
        raise HTTPException(status_code=422, detail="Container inputs are outside the supported range.")
    monthly_uses = uses_per_week * 4.33
    monthly_disposable = round(monthly_uses * disposable_cost, 2)
    cost_per_use_reusable = reusable_cost / reusable_lifespan_uses + wash_cost_per_use
    monthly_reusable = round(monthly_uses * cost_per_use_reusable, 2)
    annual_savings = round((monthly_disposable - monthly_reusable) * 12, 2)
    return {
        "scenario": "containers",
        "currency": "INR",
        "calculated": True,
        "options": [
            {"name": "Disposable", "monthly_cost": monthly_disposable, "annual_cost": round(monthly_disposable * 12, 2)},
            {
                "name": "Reusable",
                "monthly_cost": monthly_reusable,
                "annual_cost": round((monthly_reusable or 0) * 12, 2),
                "upfront_cost": reusable_cost,
            },
        ],
        "annual_savings": annual_savings,
        "formula": "monthly_cost_inr = uses_per_week × 4.33 × (user_entered_item_cost / lifespan_uses + user_entered_wash_cost_per_use)",
        "assumptions": [
            f"Usage: {uses_per_week} times per week (user-entered).",
            f"Reusable lifespan: {reusable_lifespan_uses} uses (user-entered).",
            "Waste collection or environmental impacts are not estimated.",
        ],
    }


def _calc_water(inputs: dict) -> dict:
    required = ("current_flow_lpm", "low_flow_lpm", "shower_minutes_per_day")
    missing = [name for name in required if inputs.get(name) in (None, "")]
    if missing:
        return {
            "scenario": "water",
            "currency": "INR",
            "calculated": False,
            "missing": missing,
            "note": "Measure both fixture flow rates and enter your daily shower duration. No fixture or usage is assumed.",
        }
    current_flow_lpm = float(inputs["current_flow_lpm"])
    low_flow_lpm = float(inputs["low_flow_lpm"])
    minutes_per_day = float(inputs["shower_minutes_per_day"])
    if current_flow_lpm < 0 or low_flow_lpm < 0 or minutes_per_day < 0:
        raise HTTPException(status_code=422, detail="Flow rates and shower duration must be non-negative.")
    water_price = inputs.get("water_price_per_kl")
    current_litres_day = current_flow_lpm * minutes_per_day
    low_litres_day = low_flow_lpm * minutes_per_day
    saved_litres_month = round((current_litres_day - low_litres_day) * 30, 1)
    saved_kl_month = round(saved_litres_month / 1000, 3)
    water_cost_saved = None
    if water_price not in (None, ""):
        water_cost_saved = round(saved_kl_month * float(water_price), 2)
    return {
        "scenario": "water",
        "currency": "INR",
        "calculated": True,
        "incomplete": water_price in (None, ""),
        "missing": ["water_price_per_kl"] if water_price in (None, "") else [],
        "options": [
            {"name": "Current fixtures", "flow_lpm": current_flow_lpm, "monthly_litres": round(current_litres_day * 30, 0)},
            {"name": "Lower-flow fixtures", "flow_lpm": low_flow_lpm, "monthly_litres": round(low_litres_day * 30, 0)},
        ],
        "saved_litres_month": saved_litres_month,
        "saved_kl_month": saved_kl_month,
        "water_cost_saved": water_cost_saved,
        "formula": "saved_L = (current_flow - low_flow) × minutes/day × 30; kL = L / 1000",
        "assumptions": [
            "Flow rates must be measured (bucket test) or remain assumptions.",
            "₹ savings need your bill's ₹/kL. No HMWSSB tariff is stored.",
            "Heating kWh is omitted unless you know the fuel and temperature rise.",
        ],
        "note": "Fixture flow cannot be read from a photograph.",
    }


def _calc_repair(inputs: dict) -> dict:
    if inputs.get("repair_quote_inr") in (None, "") or inputs.get("replace_price_inr") in (None, ""):
        return {
            "scenario": "repair",
            "currency": "INR",
            "calculated": False,
            "missing": ["repair_quote_inr", "replace_price_inr"],
            "note": "Enter quotes you actually received. Do not use placeholder rupee amounts.",
        }
    repair = float(inputs["repair_quote_inr"])
    replace = float(inputs["replace_price_inr"])
    return {
        "scenario": "repair",
        "currency": "INR",
        "options": [
            {"name": "Repair", "upfront_cost": repair},
            {"name": "Replace", "upfront_cost": replace},
        ],
        "difference_inr": round(replace - repair, 2),
        "cheaper": "Repair" if repair < replace else "Replace" if replace < repair else "Equal",
        "assumptions": ["GST should be included in the quotes you type.", "Safety-critical electrical/gas faults are not scored here."],
    }
