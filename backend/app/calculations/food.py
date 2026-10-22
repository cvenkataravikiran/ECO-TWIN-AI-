"""
EcoPath.AI — Food Waste Calculations
Models food expenditure losses, waste reduction targets, and estimated cost recovery.
No national waste-rate benchmark is applied; users must provide measured inputs.
"""

from typing import Dict, Any


def estimate_food_waste_savings(
    monthly_grocery_spend: float,
    current_waste_fraction: float,
    target_reduction: float,
) -> Dict[str, Any]:
    """
    Estimate financial and food expenditure recovery from meal planning and waste reduction habits.

    Args:
        monthly_grocery_spend: User-entered monthly expenditure on food/groceries in INR (>= 0).
        current_waste_fraction: Measured share of purchased food discarded uneaten (0.0–1.0).
        target_reduction: User-entered target share of measured food waste to prevent (0.0–1.0).

    Returns:
        Dict containing baseline waste expenditure, projected monthly and annual savings,
        confidence rating, assumptions, and mathematical formula.

    Raises:
        ValueError: If monthly_grocery_spend is negative or fractions are outside [0.0, 1.0].
    """
    if monthly_grocery_spend < 0:
        raise ValueError(f"monthly_grocery_spend must be non-negative, got {monthly_grocery_spend}")
    if not (0.0 <= current_waste_fraction <= 1.0):
        raise ValueError(f"current_waste_fraction must be between 0.0 and 1.0, got {current_waste_fraction}")
    if not (0.0 <= target_reduction <= 1.0):
        raise ValueError(f"target_reduction must be between 0.0 and 1.0, got {target_reduction}")

    current_waste_cost = round(monthly_grocery_spend * current_waste_fraction, 2)
    monthly_savings = round(current_waste_cost * target_reduction, 2)
    annual_savings = round(monthly_savings * 12.0, 2)

    return {
        "currency": "INR",
        "monthly_grocery_spend": monthly_grocery_spend,
        "current_waste_fraction": current_waste_fraction,
        "target_reduction_fraction": target_reduction,
        "current_waste_monthly_cost": current_waste_cost,
        "estimated_monthly_savings": monthly_savings,
        "estimated_annual_savings": annual_savings,
        "confidence": "low",
        "formula": "current_waste_cost = monthly_grocery_spend * current_waste_fraction; monthly_savings = current_waste_cost * target_reduction",
        "assumptions": [
            f"Measured household food waste is {current_waste_fraction * 100:.0f}% of purchased groceries.",
            f"The user-entered target reduction is {target_reduction * 100:.0f}%.",
            "The estimate assumes the measured waste share scales proportionally with grocery expenditure.",
        ],
        "limitations": [
            "Food waste proportions vary greatly depending on household size, dining out habits, and fresh produce consumption.",
            "A structured 7-day home kitchen audit is required for precise, verified waste accounting.",
        ],
    }
