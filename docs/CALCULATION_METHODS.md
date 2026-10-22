# EcoPath.AI — Calculation Methods

All calculations in EcoPath.AI use documented, deterministic formulas. This document describes each calculation module, its inputs, outputs, assumptions, and limitations.

## Principles

1. **Transparency** — Every calculation returns its formula and assumptions alongside its result.
2. **Honesty** — Confidence levels indicate estimate reliability. Sample emission factors are labelled as samples.
3. **Determinism** — Identical inputs always produce identical outputs.
4. **Validation** — All inputs are validated; negative or unrealistic values raise errors.

---

## Energy Calculations (`app/calculations/energy.py`)

### `calculate_annual_cost(monthly_kwh, price_per_kwh)`
- **Formula:** `annual_cost = monthly_kwh × 12 × price_per_kwh`
- **Assumptions:** Monthly consumption and price are constant across 12 months.

### `estimate_led_savings(num_bulbs, old_wattage, new_wattage, hours_per_day, price_per_kwh)`
- **Formula:** `daily_kwh_saved = (old_wattage - new_wattage) × num_bulbs × hours/day / 1000`
- **Payback:** `months = total_upfront_cost / monthly_cost_saved`
- **Confidence:** Medium — depends on assumed usage hours and bulb count.

### `estimate_standby_savings(total_monthly_kwh, standby_fraction, price_per_kwh)`
- **Formula:** `potential_saving = monthly_kwh × standby_fraction × 0.70 × price_per_kwh`
- **Note:** 0.70 factor assumes 70% of standby load is practically eliminable.
- **Confidence:** Low — standby fraction is an IEA benchmark (5-10%), not measured.

### `estimate_solar_production(panel_kwp, peak_sun_hours, efficiency)`
- **Formula:** `annual_kwh = panel_kwp × peak_sun_hours × efficiency × 365`
- **Confidence:** Low — varies dramatically by season and location.

---

## Transport Calculations (`app/calculations/transport.py`)

### `calculate_car_monthly_cost(distance_km, cost_per_km)`
- **Formula:** `monthly_cost = distance_km × cost_per_km`

### `compare_transport_modes(distance_km, days_per_week, car_cost_per_km, bike_maintenance_monthly)`
- **Car emissions:** 0.189 kg CO₂e/km (EEA sample average)
- **Bike emissions:** 0.008 kg CO₂e/km (lifecycle estimate)
- **Savings:** `car_monthly_cost - bike_monthly_maintenance`
- **Important:** Emission factors are approximate population averages.

---

## Food Calculations (`app/calculations/food.py`)

### `estimate_food_waste_savings(monthly_grocery_spend, current_waste_fraction, target_reduction)`
- **Formula:** `savings = spend × waste_fraction × target_reduction`
- **Benchmark:** 25% food waste (WRAP/FAO typical household range: 20-30%)
- **Confidence:** Low — requires individual household tracking for accuracy.

---

## Emission Factors Used

| Factor | Value | Source | Note |
|--------|-------|--------|------|
| Grid electricity | 0.25 kg CO₂e/kWh | Sample European average | Varies greatly by country |
| Car (petrol/diesel) | 0.189 kg CO₂e/km | EEA fleet average | Approximate |
| Bicycle | 0.008 kg CO₂e/km | Lifecycle estimate | Includes manufacturing |
| Public transit | 0.045 kg CO₂e/km | Urban bus/rail blend | Approximate |

> **These are sample demonstration values.** Real emission factors vary significantly by country, grid mix, vehicle type, and calculation methodology. Do not use for regulatory reporting.
