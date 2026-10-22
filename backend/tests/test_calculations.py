"""
EcoPath.AI — Energy Calculation Tests
Tests for backend/app/calculations/energy.py
"""
import pytest
from app.calculations.energy import (
    calculate_annual_cost,
    estimate_led_savings,
    estimate_standby_savings,
    estimate_solar_production,
)
from app.calculations.food import estimate_food_waste_savings
from app.calculations.transport import compare_transport_modes


class TestCalculateAnnualCost:
    def test_basic_calculation(self):
        result = calculate_annual_cost(250, 0.15)
        assert result["annual_kwh"] == 3000.0
        assert result["annual_cost"] == 450.0

    def test_zero_consumption(self):
        result = calculate_annual_cost(0, 0.15)
        assert result["annual_kwh"] == 0.0
        assert result["annual_cost"] == 0.0

    def test_negative_kwh_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            calculate_annual_cost(-10, 0.15)

    def test_negative_price_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            calculate_annual_cost(250, -0.05)

    def test_result_contains_formula(self):
        result = calculate_annual_cost(100, 0.10)
        assert "formula" in result
        assert "assumptions" in result
        assert len(result["assumptions"]) > 0

    def test_deterministic(self):
        """Identical inputs must produce identical outputs."""
        r1 = calculate_annual_cost(268, 0.15)
        r2 = calculate_annual_cost(268, 0.15)
        assert r1 == r2


class TestEstimateLedSavings:
    def test_basic_savings(self):
        result = estimate_led_savings(
            num_bulbs=10, old_wattage=60, new_wattage=9,
            hours_per_day=5, price_per_kwh=0.15,
        )
        assert result["monthly_kwh_saved"] > 0
        assert result["monthly_cost_saved"] > 0
        assert result["annual_cost_saved"] > result["monthly_cost_saved"]
        assert result["is_estimate"] is True

    def test_payback_calculated(self):
        result = estimate_led_savings(
            num_bulbs=8, old_wattage=60, new_wattage=9,
            hours_per_day=4, price_per_kwh=0.15, cost_per_bulb=100,
        )
        assert result["payback_months"] is not None
        assert result["payback_months"] > 0

    def test_payback_omitted_without_user_entered_bulb_price(self):
        result = estimate_led_savings(
            num_bulbs=8, old_wattage=60, new_wattage=9,
            hours_per_day=4, price_per_kwh=0.15,
        )
        assert result["payback_months"] is None
        assert result["total_upfront_cost_estimate"] is None

    def test_no_savings_when_same_wattage(self):
        result = estimate_led_savings(
            num_bulbs=10, old_wattage=9, new_wattage=9,
            hours_per_day=5, price_per_kwh=0.15,
        )
        assert result["monthly_kwh_saved"] == 0.0
        assert result["payback_months"] is None

    def test_zero_bulbs(self):
        result = estimate_led_savings(
            num_bulbs=0, old_wattage=60, new_wattage=9,
            hours_per_day=5, price_per_kwh=0.15,
        )
        assert result["monthly_cost_saved"] == 0.0

    def test_invalid_hours_raises(self):
        with pytest.raises(ValueError):
            estimate_led_savings(
                num_bulbs=10, old_wattage=60, new_wattage=9,
                hours_per_day=25, price_per_kwh=0.15,
            )

    def test_negative_bulbs_raises(self):
        with pytest.raises(ValueError):
            estimate_led_savings(
                num_bulbs=-1, old_wattage=60, new_wattage=9,
                hours_per_day=5, price_per_kwh=0.15,
            )


class TestEstimateStandbySavings:
    def test_basic_calculation(self):
        result = estimate_standby_savings(250, 0.075, 0.70, 15.0)
        assert result["estimated_standby_kwh"] > 0
        assert result["potential_saving_kwh"] > 0
        assert result["confidence"] == "low"

    def test_70_percent_factor(self):
        """Only 70% of standby power is assumed eliminable."""
        result = estimate_standby_savings(1000, 0.10, 0.70, 15.0)
        expected_standby = 100.0  # 1000 * 0.10
        expected_saving = 70.0   # 100 * 0.70
        assert result["estimated_standby_kwh"] == expected_standby
        assert result["potential_saving_kwh"] == expected_saving

    def test_invalid_fraction_raises(self):
        with pytest.raises(ValueError):
            estimate_standby_savings(250, 1.5, 0.70, 15.0)

    def test_money_omitted_without_entered_tariff(self):
        result = estimate_standby_savings(250, 0.075, 0.70)
        assert result["potential_saving_cost"] is None
        assert result["annual_saving_cost"] is None


class TestEstimateSolarProduction:
    def test_basic_production(self):
        result = estimate_solar_production(3.0, 4.5, 0.80)
        assert result["annual_production_kwh"] > 0
        assert result["daily_production_kwh"] > 0

    def test_zero_capacity_raises(self):
        with pytest.raises(ValueError):
            estimate_solar_production(0, 4.5, 0.80)

    def test_invalid_efficiency_raises(self):
        with pytest.raises(ValueError):
            estimate_solar_production(3.0, 4.5, 1.5)


class TestFoodWasteSavings:
    def test_uses_measured_inputs_and_inr(self):
        result = estimate_food_waste_savings(10000, 0.1, 0.25)
        assert result["currency"] == "INR"
        assert result["estimated_monthly_savings"] == 250
        assert "Measured household food waste" in result["assumptions"][0]


class TestTransportCosts:
    def test_unknown_bicycle_cost_and_emissions_are_withheld(self):
        result = compare_transport_modes(distance_km=20, days_per_week=5, car_cost_per_km=12)
        assert result["currency"] == "INR"
        assert result["bike"]["annual_cost"] is None
        assert result["comparison"]["monthly_savings"] is None
        assert result["comparison"]["annual_emissions_saved_kg_co2"] is None
