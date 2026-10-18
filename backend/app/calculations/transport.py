"""Transport cost calculations using user-entered Indian rupee amounts."""

from typing import Optional, Dict, Any

def calculate_car_monthly_cost(distance_km: float, cost_per_km: float) -> Dict[str, Any]:
    """
    Calculate monthly and annual vehicle operational costs.

    Args:
        distance_km: Total travel distance driven per month in kilometers (>= 0).
        cost_per_km: User-entered cost per kilometer in Indian rupees (>= 0).

    Returns:
        Dict containing monthly_distance_km, cost_per_km, monthly_cost, annual_cost, formula, and assumptions.

    Raises:
        ValueError: If distance_km or cost_per_km is negative.
    """
    if distance_km < 0:
        raise ValueError(f"distance_km must be non-negative, got {distance_km}")
    if cost_per_km < 0:
        raise ValueError(f"cost_per_km must be non-negative, got {cost_per_km}")

    monthly_cost = round(distance_km * cost_per_km, 2)
    annual_cost = round(monthly_cost * 12.0, 2)

    return {
        "monthly_distance_km": distance_km,
        "cost_per_km": cost_per_km,
        "monthly_cost": monthly_cost,
        "annual_cost": annual_cost,
        "currency": "INR",
        "formula": "monthly_cost = distance_km * cost_per_km; annual_cost = monthly_cost * 12",
        "assumptions": [
            "Cost per kilometer is the user-entered value; included cost components are not verified.",
            "Driving distance is assumed consistent across 12 months.",
        ],
    }


def compare_transport_modes(
    distance_km: float,
    days_per_week: float,
    car_cost_per_km: float,
    bike_maintenance_monthly: Optional[float] = None,
    bike_purchase_cost: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Compare commuter costs using user-entered costs. Emissions are withheld because
    validated India-specific mode factors are not configured.

    Args:
        distance_km: Round-trip commute distance per day in kilometers (>= 0).
        days_per_week: Number of commuting days per week (0 <= days <= 7).
        car_cost_per_km: User-entered car cost per kilometer in Indian rupees (>= 0).
        bike_maintenance_monthly: User-entered monthly bicycle upkeep, or None if unknown.
        bike_purchase_cost: User-entered bicycle purchase cost, or None if unknown.

    Returns:
        Dict comparing car vs bike monthly cost, carbon emissions, net savings, and payback period.

    Raises:
        ValueError: If inputs are negative or days_per_week > 7.
    """
    if distance_km < 0:
        raise ValueError(f"distance_km must be non-negative, got {distance_km}")
    if not (0.0 <= days_per_week <= 7.0):
        raise ValueError(f"days_per_week must be between 0 and 7, got {days_per_week}")
    if car_cost_per_km < 0:
        raise ValueError(f"car_cost_per_km must be non-negative, got {car_cost_per_km}")
    if bike_maintenance_monthly is not None and bike_maintenance_monthly < 0:
        raise ValueError(f"bike_maintenance_monthly must be non-negative, got {bike_maintenance_monthly}")
    if bike_purchase_cost is not None and bike_purchase_cost < 0:
        raise ValueError(f"bike_purchase_cost must be non-negative, got {bike_purchase_cost}")

    # 52 weeks / 12 months = 4.333 weeks per month
    monthly_trips = days_per_week * (52.0 / 12.0)
    monthly_distance_km = round(distance_km * monthly_trips, 2)

    car_monthly_cost = round(monthly_distance_km * car_cost_per_km, 2)
    bike_monthly_cost = round(bike_maintenance_monthly, 2) if bike_maintenance_monthly is not None else None

    monthly_savings = (
        round(car_monthly_cost - bike_monthly_cost, 2)
        if bike_monthly_cost is not None
        else None
    )
    annual_savings = round(monthly_savings * 12.0, 2) if monthly_savings is not None else None

    if monthly_savings is not None and monthly_savings > 0 and bike_purchase_cost is not None:
        payback_months: Optional[float] = round(bike_purchase_cost / monthly_savings, 1)
    else:
        payback_months = None

    return {
        "currency": "INR",
        "commute_distance_km_per_day": distance_km,
        "days_per_week": days_per_week,
        "monthly_distance_km": monthly_distance_km,
        "car": {
            "cost_per_km": car_cost_per_km,
            "monthly_cost": car_monthly_cost,
            "annual_cost": round(car_monthly_cost * 12.0, 2),
            "monthly_emissions_kg_co2": None,
            "annual_emissions_kg_co2": None,
            "emission_factor": None,
        },
        "bike": {
            "upfront_purchase_cost": bike_purchase_cost,
            "monthly_maintenance_cost": bike_monthly_cost,
            "annual_cost": round(bike_monthly_cost * 12.0, 2) if bike_monthly_cost is not None else None,
            "monthly_emissions_kg_co2": None,
            "annual_emissions_kg_co2": None,
            "emission_factor": None,
        },
        "comparison": {
            "monthly_savings": monthly_savings,
            "annual_savings": annual_savings,
            "monthly_emissions_saved_kg_co2": None,
            "annual_emissions_saved_kg_co2": None,
            "payback_months": payback_months,
        },
        "assumptions": [
            f"Active commuting replaces car journey for {days_per_week} days/week (4.33 weeks per month).",
            f"Car operating cost of ₹{car_cost_per_km:.2f}/km was entered by the user.",
            "Bicycle cost and maintenance are omitted unless entered by the user.",
            "Transport emissions are not calculated because validated India-specific factors are unavailable.",
        ],
        "limitations": [
            "Weather conditions, seasonal variations, and personal topography may limit year-round cycling.",
            "Vehicle depreciation may still accrue if the car is retained rather than sold.",
            "No vehicle-specific fuel consumption or transport emissions are inferred.",
        ],
    }
