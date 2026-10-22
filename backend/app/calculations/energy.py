"""
EcoPath.AI — Energy Calculations
All formulas are documented. Inputs and outputs use explicit units.
"""

from typing import Optional, Dict, Any


def calculate_annual_cost(monthly_kwh: float, price_per_kwh: float) -> Dict[str, Any]:
    """
    Calculate annual electricity consumption and cost based on monthly kWh and unit price.

    Args:
        monthly_kwh: Average electricity consumption in kilowatt-hours per month (>= 0).
        price_per_kwh: User-entered price in Indian rupees per kilowatt-hour (>= 0).

    Returns:
        Dict containing annual_kwh, annual_cost, formula, and assumptions.

    Raises:
        ValueError: If monthly_kwh or price_per_kwh is negative.
    """
    if monthly_kwh < 0:
        raise ValueError(f"monthly_kwh must be non-negative, got {monthly_kwh}")
    if price_per_kwh < 0:
        raise ValueError(f"price_per_kwh must be non-negative, got {price_per_kwh}")

    annual_kwh = round(monthly_kwh * 12.0, 2)
    annual_cost = round(annual_kwh * price_per_kwh, 2)

    return {
        "monthly_kwh": monthly_kwh,
        "price_per_kwh": price_per_kwh,
        "annual_kwh": annual_kwh,
        "annual_cost": annual_cost,
        "currency": "INR",
        "formula": "annual_kwh = monthly_kwh * 12; annual_cost_inr = annual_kwh * price_per_kwh_inr",
        "assumptions": [
            "Monthly consumption is assumed constant across all 12 calendar months.",
            "Electricity tariff rate is assumed constant throughout the 12-month period.",
            "Does not include standing daily utility connection charges unless folded into the unit rate.",
        ],
    }


def estimate_led_savings(
    num_bulbs: int,
    old_wattage: float,
    new_wattage: float,
    hours_per_day: float,
    price_per_kwh: float,
    days_per_year: int = 365,
    cost_per_bulb: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Estimate electricity and cost savings from replacing incandescent/halogen bulbs with LEDs.

    Args:
        num_bulbs: Number of fixtures/bulbs being replaced (>= 0).
        old_wattage: Power rating of existing bulb in watts (e.g. 60W incandescent).
        new_wattage: Power rating of replacement LED bulb in watts (e.g. 8.5W LED).
        hours_per_day: Average operating hours per bulb per day (0 <= hours <= 24).
        price_per_kwh: User-entered price in Indian rupees per kWh (>= 0).
        days_per_year: Operating days per year (default 365).
        cost_per_bulb: User-entered replacement cost per LED bulb. If omitted, upfront cost
            and payback are not estimated.

    Returns:
        Dict containing monthly_kwh_saved, monthly_cost_saved, annual_cost_saved,
        payback_months, formula, assumptions, and is_estimate flag.

    Raises:
        ValueError: If inputs are negative, unrealistic, or out of acceptable bounds.
    """
    if num_bulbs < 0:
        raise ValueError(f"num_bulbs must be non-negative, got {num_bulbs}")
    if old_wattage <= 0:
        raise ValueError(f"old_wattage must be greater than zero, got {old_wattage}")
    if new_wattage < 0:
        raise ValueError(f"new_wattage must be non-negative, got {new_wattage}")
    if hours_per_day < 0 or hours_per_day > 24:
        raise ValueError(f"hours_per_day must be between 0 and 24, got {hours_per_day}")
    if price_per_kwh < 0:
        raise ValueError(f"price_per_kwh must be non-negative, got {price_per_kwh}")
    if cost_per_bulb is not None and cost_per_bulb < 0:
        raise ValueError(f"cost_per_bulb must be non-negative, got {cost_per_bulb}")
    if days_per_year <= 0 or days_per_year > 366:
        raise ValueError(f"days_per_year must be between 1 and 366, got {days_per_year}")

    watt_diff = old_wattage - new_wattage

    if watt_diff <= 0 or num_bulbs == 0 or hours_per_day == 0:
        return {
            "num_bulbs": num_bulbs,
            "old_wattage": old_wattage,
            "new_wattage": new_wattage,
            "hours_per_day": hours_per_day,
            "currency": "INR",
            "monthly_kwh_saved": 0.0,
            "monthly_cost_saved": 0.0,
            "annual_kwh_saved": 0.0,
            "annual_cost_saved": 0.0,
            "total_upfront_cost_estimate": None,
            "payback_months": None,
            "formula": "kwh_saved = (old_watts - new_watts) * num_bulbs * hours_per_day * days / 1000",
            "assumptions": [
                "New bulb wattage is equal to or greater than old wattage; no energy savings achievable.",
            ],
            "is_estimate": True,
        }

    daily_kwh_saved = (watt_diff * num_bulbs * hours_per_day) / 1000.0
    annual_kwh_saved = round(daily_kwh_saved * days_per_year, 2)
    monthly_kwh_saved = round(annual_kwh_saved / 12.0, 2)

    monthly_cost_saved = round(monthly_kwh_saved * price_per_kwh, 2)
    annual_cost_saved = round(annual_kwh_saved * price_per_kwh, 2)

    total_upfront_cost = num_bulbs * cost_per_bulb if cost_per_bulb is not None else None
    if monthly_cost_saved > 0 and total_upfront_cost is not None:
        payback_months: Optional[float] = round(total_upfront_cost / monthly_cost_saved, 1)
    else:
        payback_months = None

    return {
        "num_bulbs": num_bulbs,
        "old_wattage": old_wattage,
        "new_wattage": new_wattage,
        "hours_per_day": hours_per_day,
        "currency": "INR",
        "monthly_kwh_saved": monthly_kwh_saved,
        "monthly_cost_saved": monthly_cost_saved,
        "annual_kwh_saved": annual_kwh_saved,
        "annual_cost_saved": annual_cost_saved,
        "total_upfront_cost_estimate": round(total_upfront_cost, 2) if total_upfront_cost is not None else None,
        "payback_months": payback_months,
        "formula": "daily_kwh_saved = ((old_wattage - new_wattage) * num_bulbs * hours_per_day) / 1000; annual_cost_saved_inr = annual_kwh_saved * price_per_kwh_inr",
        "assumptions": [
            f"Bulbs are operated on average {hours_per_day} hours every day of the year.",
            f"Electricity price remains fixed at {price_per_kwh} per kWh.",
            f"LED replacement bulb cost: ₹{cost_per_bulb:.2f} per bulb (user-entered)." if cost_per_bulb is not None
            else "Upfront bulb cost and payback are omitted until the user enters a bulb price.",
            "Does not factor in replacement labor or extended bulb lifespan (LEDs last ~15,000–25,000 hours vs ~1,000 hours for incandescent).",
        ],
        "is_estimate": True,
    }


def estimate_standby_savings(
    total_monthly_kwh: float,
    standby_fraction: float,
    manageable_fraction: float,
    price_per_kwh: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Estimate savings from eliminating vampire/standby power using switched smart power strips.

    Args:
        total_monthly_kwh: Baseline monthly electricity consumption (>= 0).
        standby_fraction: Measured fraction of electricity consumed on standby (0.0 to 1.0).
        manageable_fraction: Measured share of standby consumption that can be reduced (0.0 to 1.0).
        price_per_kwh: User-entered electricity price in INR/kWh. If omitted, monetary savings are withheld.

    Returns:
        Dict containing estimated_standby_kwh, potential_saving_kwh, potential_saving_cost,
        confidence, formula, and assumptions.

    Raises:
        ValueError: If inputs are negative or standby_fraction is outside [0.0, 1.0].
    """
    if total_monthly_kwh < 0:
        raise ValueError(f"total_monthly_kwh must be non-negative, got {total_monthly_kwh}")
    if not (0.0 <= standby_fraction <= 1.0):
        raise ValueError(f"standby_fraction must be between 0.0 and 1.0, got {standby_fraction}")
    if not (0.0 <= manageable_fraction <= 1.0):
        raise ValueError(f"manageable_fraction must be between 0.0 and 1.0, got {manageable_fraction}")
    if price_per_kwh is not None and price_per_kwh < 0:
        raise ValueError(f"price_per_kwh must be non-negative, got {price_per_kwh}")

    estimated_standby_kwh = round(total_monthly_kwh * standby_fraction, 2)
    potential_saving_kwh = round(estimated_standby_kwh * manageable_fraction, 2)
    potential_saving_cost = (
        round(potential_saving_kwh * price_per_kwh, 2)
        if price_per_kwh is not None
        else None
    )
    annual_saving_cost = (
        round(potential_saving_cost * 12.0, 2)
        if potential_saving_cost is not None
        else None
    )

    return {
        "total_monthly_kwh": total_monthly_kwh,
        "standby_fraction": standby_fraction,
        "estimated_standby_kwh": estimated_standby_kwh,
        "potential_saving_kwh": potential_saving_kwh,
        "potential_saving_cost": potential_saving_cost,
        "annual_saving_cost": annual_saving_cost,
        "currency": "INR",
        "confidence": "low",
        "formula": "estimated_standby_kwh = total_monthly_kwh * measured_standby_fraction; potential_saving_kwh = estimated_standby_kwh * measured_manageable_fraction; monetary_savings_inr = potential_saving_kwh * user_entered_price_per_kwh_inr",
        "assumptions": [
            f"Measured standby fraction supplied as {standby_fraction * 100:.1f}%.",
            f"Measured manageable share supplied as {manageable_fraction * 100:.1f}%.",
            "Essential always-on devices (Wi-Fi routers, refrigerators, medical equipment, security alarms) are excluded from shutoff.",
            "Individual plug-level measurement is required to determine exact device loads.",
            "Monetary savings are omitted when a user-entered electricity tariff is unavailable.",
        ],
    }


def estimate_solar_production(
    panel_kwp: float,
    peak_sun_hours: float,
    efficiency: float,
) -> Dict[str, Any]:
    """
    Estimate electrical energy production from a rooftop solar photovoltaic (PV) system.

    Args:
        panel_kwp: Total nameplate capacity of the solar array in kilowatt-peak (kWp > 0).
        peak_sun_hours: Average daily solar insolation in peak sun hours per day (h/day > 0).
        efficiency: System performance ratio derate factor accounting for inverter losses,
                    cable resistance, temperature, and dirt (user-entered; 0.0 < efficiency <= 1.0).

    Returns:
        Dict containing daily, monthly, and annual estimated kWh production, assumptions, and limitations.

    Raises:
        ValueError: If inputs are negative or efficiency is outside (0.0, 1.0].
    """
    if panel_kwp <= 0:
        raise ValueError(f"panel_kwp must be greater than zero, got {panel_kwp}")
    if peak_sun_hours <= 0:
        raise ValueError(f"peak_sun_hours must be greater than zero, got {peak_sun_hours}")
    if not (0.0 < efficiency <= 1.0):
        raise ValueError(f"efficiency must be between 0.0 (exclusive) and 1.0 (inclusive), got {efficiency}")

    daily_production_kwh = panel_kwp * peak_sun_hours * efficiency
    annual_production_kwh = round(daily_production_kwh * 365.0, 2)
    monthly_production_kwh = round(annual_production_kwh / 12.0, 2)

    return {
        "panel_kwp": panel_kwp,
        "peak_sun_hours": peak_sun_hours,
        "efficiency": efficiency,
        "daily_production_kwh": round(daily_production_kwh, 2),
        "monthly_production_kwh": monthly_production_kwh,
        "annual_production_kwh": annual_production_kwh,
        "formula": "annual_production_kwh = panel_kwp * peak_sun_hours * efficiency * 365",
        "assumptions": [
            f"System performance derate ratio of {efficiency * 100:.0f}% accounts for inverter DC-to-AC conversion, wiring losses, panel degradation, and dirt/soiling.",
            f"Annual average solar resource benchmarked at {peak_sun_hours} peak sun hours/day.",
            "Unshaded south/south-west orientation with 30°–35° pitch assumed for northern hemisphere installations.",
        ],
        "limitations": [
            "Actual solar output varies dramatically by season (winter generation is typically 20-30% of summer peaks in temperate zones).",
            "Total electricity produced does not equal direct utility savings unless matched with load self-consumption or battery storage.",
            "Local grid feed-in tariffs, net-metering policies, and utility connection rules determine the monetary value of exported energy.",
            "Professional structural, electrical, and shading assessments are required before physical procurement.",
        ],
    }
