"""
EcoTwin AI — Rule-Based Recommendation Engine

This engine applies deterministic rules to user context.
It does NOT use any generative AI or LLM.
All recommendations are traceable to knowledge base entries and documented formulas.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class UserContext:
    workspace_type: str = "individual"  # 'individual' or 'business'
    monthly_electricity_kwh: Optional[float] = None
    monthly_electricity_cost: Optional[float] = None
    monthly_grocery_spend: Optional[float] = None
    monthly_travel_km: Optional[float] = None
    travel_mode: Optional[str] = None  # 'car', 'cycling', 'public-transport', 'walking'
    monthly_water_liters: Optional[float] = None
    monthly_waste_kg: Optional[float] = None
    monthly_shopping_spend: Optional[float] = None
    price_per_kwh: float = 0.0
    goals: List[str] = field(default_factory=list)  # ['reduce-costs', 'reduce-emissions', 'reduce-waste']
    currency: str = "INR"


@dataclass
class RecommendationResult:
    id: str
    title: str
    category: str
    relevance_explanation: str
    knowledge_article_id: Optional[str]
    difficulty: str  # 'easy', 'moderate', 'challenging', 'complex'
    estimated_monthly_savings: Optional[float]
    estimated_monthly_savings_currency: str
    environmental_estimate: Optional[Dict[str, Any]]
    formula_description: str
    assumptions: List[str]
    confidence_level: str  # 'high', 'medium', 'low', 'insufficient'
    priority_score: int
    prioritization_reason: str
    missing_data: List[str]  # data that would improve the estimate

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "relevance_explanation": self.relevance_explanation,
            "relevanceExplanation": self.relevance_explanation,
            "knowledge_article_id": self.knowledge_article_id,
            "knowledgeArticleId": self.knowledge_article_id,
            "difficulty": self.difficulty,
            "estimated_monthly_savings": self.estimated_monthly_savings,
            "estimatedMonthlySavings": self.estimated_monthly_savings,
            "estimated_monthly_savings_currency": self.estimated_monthly_savings_currency,
            "estimatedMonthlySavingsCurrency": self.estimated_monthly_savings_currency,
            "environmental_estimate": self.environmental_estimate,
            "environmentalEstimate": self.environmental_estimate,
            "formula_description": self.formula_description,
            "formulaDescription": self.formula_description,
            "assumptions": self.assumptions,
            "confidence_level": self.confidence_level,
            "confidenceLevel": self.confidence_level,
            "priority_score": self.priority_score,
            "priorityScore": self.priority_score,
            "prioritization_reason": self.prioritization_reason,
            "prioritizationReason": self.prioritization_reason,
            "missing_data": self.missing_data,
            "missingData": self.missing_data,
        }


ACTIVE_RULES: List[Dict[str, Any]] = [
    {
        "id": "rule-001-led",
        "name": "LED Lighting Upgrade",
        "category": "home-energy",
        "knowledge_article_id": "kb-001",
        "recommendation_id": "rec-001",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly_electricity_kwh > 100",
        "calculation_module": "app.calculations.energy.estimate_led_savings",
        "description": "Suggests reviewing lighting when recorded monthly electricity use is high; no savings or emissions are estimated without lighting-specific measurements.",
    },
    {
        "id": "rule-002-standby",
        "name": "Standby Vampire Power Reduction",
        "category": "home-energy",
        "knowledge_article_id": "kb-002",
        "recommendation_id": "rec-002",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly_electricity_kwh is present",
        "calculation_module": "app.calculations.energy.estimate_standby_savings",
        "description": "Suggests measuring idle-device consumption; no standby load or savings are inferred from total electricity use.",
    },
    {
        "id": "rule-003-food-waste",
        "name": "Household Food Waste Prevention",
        "category": "food-kitchen",
        "knowledge_article_id": "kb-003",
        "recommendation_id": "rec-003",
        "target_audience": ["individual", "household"],
        "trigger_condition": "monthly_grocery_spend > 0",
        "calculation_module": "app.calculations.food.estimate_food_waste_savings",
        "description": "Suggests tracking kitchen waste; no waste percentage or savings are assumed.",
    },
    {
        "id": "rule-004-active-travel",
        "name": "Modal Shift to Active Commuting",
        "category": "travel-transport",
        "knowledge_article_id": "kb-004",
        "recommendation_id": "rec-004",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly_travel_km > 0 and travel_mode == 'car'",
        "calculation_module": "app.calculations.transport.compare_transport_modes",
        "description": "Suggests considering alternatives for recorded car travel; no costs or emissions are estimated.",
    },
    {
        "id": "rule-005-water-efficiency",
        "name": "Domestic Water Conservation",
        "category": "water-nature",
        "knowledge_article_id": "kb-006",
        "recommendation_id": "rec-005",
        "target_audience": ["individual", "business"],
        "trigger_condition": "'reduce-water' in goals or no other recommendations apply",
        "calculation_module": None,
        "description": "Suggests measuring fixture flow and checking for leaks; no water, cost, or emissions estimates are made.",
    },
]

ACTIVE_RULES.extend([
    {
        "id": "rule-006-water-meter",
        "name": "Water meter and leak review",
        "category": "water-nature",
        "knowledge_article_id": "kb-010",
        "recommendation_id": "rec-006",
        "target_audience": ["individual", "business"],
        "trigger_condition": "measured monthly water quantity > 0",
        "calculation_module": None,
        "description": "Prompts a meter and visible-leak review without inferring savings from a water bill.",
    },
    {
        "id": "rule-007-water-fixture",
        "name": "Measure water fixture flow",
        "category": "water-nature",
        "knowledge_article_id": "kb-010",
        "recommendation_id": "rec-007",
        "target_audience": ["individual", "business"],
        "trigger_condition": "measured monthly water quantity > 0",
        "calculation_module": None,
        "description": "Asks for fixture-level flow before comparing fittings.",
    },
    {
        "id": "rule-008-waste-audit",
        "name": "Waste stream measurement",
        "category": "waste-circular",
        "knowledge_article_id": "kb-011",
        "recommendation_id": "rec-008",
        "target_audience": ["individual", "business"],
        "trigger_condition": "measured monthly waste quantity > 0",
        "calculation_module": None,
        "description": "Prompts waste stream measurement without assuming composition.",
    },
    {
        "id": "rule-009-local-sorting",
        "name": "Local waste sorting instructions",
        "category": "waste-circular",
        "knowledge_article_id": "kb-012",
        "recommendation_id": "rec-009",
        "target_audience": ["individual", "business"],
        "trigger_condition": "measured monthly waste quantity > 0",
        "calculation_module": None,
        "description": "Directs users to verify current local waste instructions.",
    },
    {
        "id": "rule-010-repair",
        "name": "Repair versus replacement",
        "category": "shopping-products",
        "knowledge_article_id": "kb-013",
        "recommendation_id": "rec-010",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly shopping spend > 0",
        "calculation_module": None,
        "description": "Prompts an item-specific quote comparison; no assumed savings.",
    },
    {
        "id": "rule-011-purchase-planning",
        "name": "Durable purchase planning",
        "category": "shopping-products",
        "knowledge_article_id": "kb-014",
        "recommendation_id": "rec-011",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly shopping spend > 0",
        "calculation_module": None,
        "description": "Prompts review of model-specific product, warranty, and repair information.",
    },
    {
        "id": "rule-012-travel-log",
        "name": "Trip-level travel baseline",
        "category": "travel-transport",
        "knowledge_article_id": "kb-015",
        "recommendation_id": "rec-012",
        "target_audience": ["individual", "business"],
        "trigger_condition": "measured monthly travel distance > 0",
        "calculation_module": None,
        "description": "Requests trip- and mode-level data before travel alternatives are compared.",
    },
    {
        "id": "rule-013-appliance-inventory",
        "name": "Appliance-level electricity inventory",
        "category": "home-energy",
        "knowledge_article_id": "kb-016",
        "recommendation_id": "rec-013",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly electricity use > 0",
        "calculation_module": None,
        "description": "Prompts appliance-level measurement without equating rated power with measured consumption.",
    },
    {
        "id": "rule-014-food-inventory",
        "name": "Food inventory and meal planning",
        "category": "food-kitchen",
        "knowledge_article_id": "kb-017",
        "recommendation_id": "rec-014",
        "target_audience": ["individual", "business"],
        "trigger_condition": "monthly grocery spend > 0",
        "calculation_module": None,
        "description": "Prompts food inventory and measured waste tracking without applying an assumed waste fraction.",
    },
    {
        "id": "rule-015-business-review",
        "name": "Business resource data quality review",
        "category": "business-institutions",
        "knowledge_article_id": "kb-018",
        "recommendation_id": "rec-015",
        "target_audience": ["business"],
        "trigger_condition": "business workspace has measured resource data",
        "calculation_module": None,
        "description": "Prompts consistent site, period, and source records for organisations.",
    },
])


def generate_recommendations(context: UserContext) -> List[RecommendationResult]:
    """
    Generate ranked recommendations for a given user context.
    Returns deterministic results for identical inputs.
    """
    recommendations: List[RecommendationResult] = []
    goals = context.goals or []
    wants_cost_reduction = "reduce-costs" in goals
    wants_emission_reduction = "reduce-emissions" in goals
    wants_waste_reduction = "reduce-waste" in goals

    # Determine effective electricity kWh if only cost is provided
    effective_kwh = context.monthly_electricity_kwh
    if effective_kwh is None and context.monthly_electricity_cost and context.price_per_kwh > 0:
        effective_kwh = context.monthly_electricity_cost / context.price_per_kwh

    # -------------------------------------------------------------
    # Rule 1: LED Lighting Upgrade
    # -------------------------------------------------------------
    if effective_kwh and effective_kwh > 100:
        priority = 85
        reasons = ["Significant baseline electricity consumption detected (>100 kWh/month)."]
        if wants_cost_reduction:
            priority += 5
            reasons.append("Aligned with your goal to reduce monthly utility expenditures.")
        if wants_emission_reduction:
            priority += 3
            reasons.append("Aligned with your goal; emissions are not estimated.")

        recommendations.append(
            RecommendationResult(
                id="rec-001",
                title="Switch to LED Lighting",
                category="home-energy",
                relevance_explanation=f"Your recorded electricity consumption is {effective_kwh:.0f} kWh/month. Reviewing lamp wattages and operating hours may identify opportunities to reduce use.",
                knowledge_article_id="kb-001",
                difficulty="easy",
                estimated_monthly_savings=None,
                estimated_monthly_savings_currency=context.currency,
                environmental_estimate=None,
                formula_description="No savings or emissions estimate is produced until lamp counts, wattages, operating hours, tariff, and a validated emissions factor are available.",
                assumptions=["The recorded monthly electricity total does not identify lighting consumption."],
                confidence_level="insufficient",
                priority_score=priority,
                prioritization_reason="; ".join(reasons),
                missing_data=[
                    "Number and wattage of lamps",
                    "Daily operating hours by lamp",
                    "User-entered electricity tariff for cost estimates",
                ],
            )
        )

    # -------------------------------------------------------------
    # Rule 2: Standby Vampire Power Reduction
    # -------------------------------------------------------------
    if effective_kwh and effective_kwh > 0:
        priority = 75
        reasons = ["Your recorded electricity use may include devices that draw power while idle."]
        if wants_cost_reduction:
            priority += 5
            reasons.append("Aligned with your goal; savings are not estimated.")

        recommendations.append(
            RecommendationResult(
                id="rec-002",
                title="Eliminate Standby Power with Switched Strips",
                category="home-energy",
                relevance_explanation="Measure individual devices in standby before deciding whether to switch them off. Do not disconnect equipment that must remain powered.",
                knowledge_article_id="kb-002",
                difficulty="easy",
                estimated_monthly_savings=None,
                estimated_monthly_savings_currency=context.currency,
                environmental_estimate=None,
                formula_description="No energy, cost, or emissions estimate is produced without measured standby consumption and a validated emissions factor.",
                assumptions=["A monthly electricity total alone does not reveal standby consumption."],
                confidence_level="insufficient",
                priority_score=priority,
                prioritization_reason="; ".join(reasons),
                missing_data=[
                    "Individual device standby wattages measured via plug meter",
                    "Count of media consoles and PC workstations",
                ],
            )
        )

    # -------------------------------------------------------------
    # Rule 3: Household Food Waste Prevention
    # -------------------------------------------------------------
    if context.monthly_grocery_spend and context.monthly_grocery_spend > 0:
        priority = 80
        reasons = [f"Monthly grocery spend of ₹{context.monthly_grocery_spend:.0f} presents waste-reduction leverage if you confirm a waste fraction."]
        if wants_waste_reduction:
            priority += 8
            reasons.append("Directly targets your waste-reduction objective.")
        if wants_cost_reduction:
            priority += 4
            reasons.append("Aligned with your goal; savings are not estimated.")

        recommendations.append(
            RecommendationResult(
                id="rec-003",
                title="Implement Structured Meal Planning & Food Storage",
                category="food-kitchen",
                relevance_explanation=f"With grocery spending of ₹{context.monthly_grocery_spend:.0f}/month, EcoTwin will not assume a national waste percentage. Enter a measured waste fraction to estimate rupee savings.",
                knowledge_article_id="kb-003",
                difficulty="easy",
                estimated_monthly_savings=None,
                estimated_monthly_savings_currency=context.currency,
                environmental_estimate=None,
                formula_description="rupee_saving = monthly_grocery_spend × user_waste_fraction × reduction; withheld until you enter a measured waste fraction",
                assumptions=["No national food-waste percentage is applied to Indian kitchens."],
                confidence_level="low",
                priority_score=priority,
                prioritization_reason="; ".join(reasons),
                missing_data=[
                    "7-day kitchen waste tracking log (edible vs inedible fractions)",
                    "Household composition and dining out frequency",
                ],
            )
        )

    # -------------------------------------------------------------
    # Rule 4: Active Travel Modal Shift
    # -------------------------------------------------------------
    if (
        context.monthly_travel_km
        and context.monthly_travel_km > 0
        and context.travel_mode == "car"
    ):
        priority = 72
        reasons = [f"Monthly car travel of {context.monthly_travel_km:.0f} km indicates modal shift potential for local journeys."]
        if wants_emission_reduction:
            priority += 10
            reasons.append("Aligned with your goal; emissions are not estimated.")
        if wants_cost_reduction:
            priority += 5
            reasons.append("Aligned with your goal; cost savings are not estimated.")
        recommendations.append(
            RecommendationResult(
                id="rec-004",
                title="Switch Short Vehicle Commutes to Cycling or Walking",
                category="travel-transport",
                relevance_explanation=f"You recorded {context.monthly_travel_km:.0f} km of monthly travel by car. Compare locally available alternatives for trips that are practical to walk or cycle.",
                knowledge_article_id="kb-004",
                difficulty="moderate",
                estimated_monthly_savings=None,
                estimated_monthly_savings_currency=context.currency,
                environmental_estimate=None,
                formula_description="No cost or emissions estimate is produced without user-entered mode-specific costs and validated emissions factors.",
                assumptions=["Recorded travel distance does not identify trip purpose, route feasibility, vehicle efficiency, or alternative-mode costs."],
                confidence_level="insufficient",
                priority_score=priority,
                prioritization_reason="; ".join(reasons),
                missing_data=[
                    "Trip purposes and distances",
                    "Actual monthly costs by travel mode",
                    "Local route and public transport availability",
                ],
            )
        )

    # -------------------------------------------------------------
    # Rule 5: Domestic Water Conservation Fixtures (General / Goal-driven)
    # -------------------------------------------------------------
    if "reduce-water" in goals or not recommendations:
        priority = 65
        if "reduce-water" in goals:
            priority += 8

        recommendations.append(
            RecommendationResult(
                id="rec-005",
                title="Measure water use before choosing an action",
                category="water-nature",
                relevance_explanation="Record a water meter or bill quantity and check visible fixtures before choosing a water-saving intervention.",
                knowledge_article_id="kb-006",
                difficulty="easy",
                estimated_monthly_savings=None,
                estimated_monthly_savings_currency=context.currency,
                environmental_estimate=None,
                formula_description="No water, cost, or emissions estimate is produced without measured flow, usage, local tariffs, and heating details.",
                assumptions=["Flow and usage are not inferred from workspace electricity or travel records."],
                confidence_level="insufficient",
                priority_score=priority,
                prioritization_reason="Start with a water baseline when no more specific recommendation applies.",
                missing_data=[
                    "Current showerhead flow rate (measured with 1-liter jug test)",
                    "Water heating fuel source and user-entered local tariffs",
                ],
            )
        )

    def add_guidance(
        *,
        id: str,
        title: str,
        category: str,
        article_id: str,
        relevance: str,
        difficulty: str,
        priority: int,
        reason: str,
        missing_data: List[str],
        assumptions: Optional[List[str]] = None,
    ) -> None:
        recommendations.append(
            RecommendationResult(
                id=id,
                title=title,
                category=category,
                relevance_explanation=relevance,
                knowledge_article_id=article_id,
                difficulty=difficulty,
                estimated_monthly_savings=None,
                estimated_monthly_savings_currency=context.currency,
                environmental_estimate=None,
                formula_description="No savings or environmental impact is estimated; this recommendation is an evidence-gathering or practical-action prompt.",
                assumptions=assumptions or ["The recommendation does not infer unrecorded usage, local service availability, or environmental impact."],
                confidence_level="insufficient",
                priority_score=priority,
                prioritization_reason=reason,
                missing_data=missing_data,
            )
        )

    if context.monthly_water_liters is not None and context.monthly_water_liters > 0:
        add_guidance(
            id="rec-006",
            title="Check water use and look for leaks",
            category="water-nature",
            article_id="kb-010",
            relevance=f"You recorded {context.monthly_water_liters:.0f} L of water use. Check the meter and fixtures for unexplained changes before deciding on an intervention.",
            difficulty="easy",
            priority=70,
            reason="A measured water record is available for the workspace.",
            missing_data=["Comparable monthly meter readings", "Local water tariff if you want a cost comparison"],
        )
        add_guidance(
            id="rec-007",
            title="Measure fixture flow before changing fittings",
            category="water-nature",
            article_id="kb-010",
            relevance="A short bucket-and-timer test can establish flow at a fixture before you compare replacement options.",
            difficulty="easy",
            priority=62,
            reason="A measured water record is available, but fixture-level use is not recorded.",
            missing_data=["Fixture flow in litres per minute", "Usage duration and water-heating source"],
        )

    if context.monthly_waste_kg is not None and context.monthly_waste_kg > 0:
        add_guidance(
            id="rec-008",
            title="Track waste by stream before choosing a reduction action",
            category="waste-circular",
            article_id="kb-011",
            relevance=f"You recorded {context.monthly_waste_kg:.1f} kg of waste. Separate the measured amount by type to identify what can realistically be prevented or reused.",
            difficulty="easy",
            priority=74,
            reason="A positive monthly waste quantity is recorded.",
            missing_data=["Wet, dry, recyclable, and residual quantities", "Whether the record is measured or estimated"],
        )
        add_guidance(
            id="rec-009",
            title="Confirm local waste-sorting instructions",
            category="waste-circular",
            article_id="kb-012",
            relevance="Sorting rules and accepted materials vary by local authority; check the current local instructions before changing disposal practices.",
            difficulty="easy",
            priority=66,
            reason="A positive monthly waste quantity is recorded.",
            missing_data=["Your Urban Local Body's current segregation guidance", "Collection options for e-waste and batteries"],
        )

    if context.monthly_shopping_spend is not None and context.monthly_shopping_spend > 0:
        add_guidance(
            id="rec-010",
            title="Compare repair and replacement before buying",
            category="shopping-products",
            article_id="kb-013",
            relevance=f"You recorded ₹{context.monthly_shopping_spend:.0f} in shopping costs. For durable goods, compare an actual repair quote with the replacement price before deciding.",
            difficulty="moderate",
            priority=68,
            reason="A positive monthly shopping spend is recorded; durable-goods purchases are not identified separately.",
            missing_data=["Item-specific repair quote", "Replacement price and safety requirements"],
        )
        add_guidance(
            id="rec-011",
            title="Plan purchases around need, repairability, and lifespan",
            category="shopping-products",
            article_id="kb-014",
            relevance="Use a short needs list and check repair options and product information before making a durable-goods purchase.",
            difficulty="easy",
            priority=60,
            reason="A positive monthly shopping spend is recorded; purchase types are not classified.",
            missing_data=["Item-level purchase categories", "Warranty, repair, and product-label information"],
        )

    if context.monthly_travel_km is not None and context.monthly_travel_km > 0:
        add_guidance(
            id="rec-012",
            title="Record trip purpose and mode before comparing journeys",
            category="travel-transport",
            article_id="kb-015",
            relevance=f"You recorded {context.monthly_travel_km:.0f} km of monthly travel. Break it into trips and modes so practical alternatives can be compared without assuming all journeys are interchangeable.",
            difficulty="easy",
            priority=64,
            reason="A positive monthly travel distance is recorded.",
            missing_data=["Trip distance and purpose", "Mode and actual cost for each trip", "Route accessibility and safety"],
        )

    if effective_kwh is not None and effective_kwh > 0:
        add_guidance(
            id="rec-013",
            title="Inventory major electricity loads",
            category="home-energy",
            article_id="kb-016",
            relevance="A bill total is a useful baseline, but it does not identify which appliances use electricity. Record appliance wattage and operating time before prioritising changes.",
            difficulty="moderate",
            priority=63,
            reason="A positive electricity baseline is available, but appliance-level use is not.",
            missing_data=["Appliance wattage", "Operating hours", "Measured standby loads where relevant"],
        )

    if context.monthly_grocery_spend is not None and context.monthly_grocery_spend > 0:
        add_guidance(
            id="rec-014",
            title="Use a food inventory to plan the next shop",
            category="food-kitchen",
            article_id="kb-017",
            relevance="A simple inventory of food already on hand can support meal planning; track discarded food separately before estimating any savings.",
            difficulty="easy",
            priority=67,
            reason="A positive monthly grocery spend is recorded.",
            missing_data=["Food discarded over a representative week", "Edible and inedible waste separated"],
        )

    has_resource_data = any(value is not None and value > 0 for value in (
        effective_kwh,
        context.monthly_grocery_spend,
        context.monthly_travel_km,
        context.monthly_water_liters,
        context.monthly_waste_kg,
        context.monthly_shopping_spend,
    ))
    if context.workspace_type == "business" and has_resource_data:
        add_guidance(
            id="rec-015",
            title="Review resource records by site and reporting period",
            category="business-institutions",
            article_id="kb-018",
            relevance="Keep measured bills, estimated quantities, locations, and reporting periods distinct so operational comparisons use consistent data.",
            difficulty="moderate",
            priority=72,
            reason="This is a business workspace with resource data.",
            missing_data=["Site-level records", "Consistent reporting periods", "Named owner for each data source"],
        )

    # Sort deterministically by priority_score descending, then id
    recommendations.sort(key=lambda r: (r.priority_score, r.id), reverse=True)
    return recommendations
