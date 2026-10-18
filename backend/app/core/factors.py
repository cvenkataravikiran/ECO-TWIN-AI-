"""Load configurable calculation factors from knowledge_base JSON files."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from app.core.config import settings


def _factors_path() -> Path:
    return settings.project_root / "knowledge_base" / "calculation_factors" / "india_defaults.json"


@lru_cache(maxsize=1)
def load_factors() -> dict[str, Any]:
    path = _factors_path()
    if not path.exists():
        return {
            "locale": {"currency": "INR", "number_locale": "en-IN"},
            "electricity_grid": {"factor_kg_co2e_per_kwh": None, "verification_status": "unverified"},
        }
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def grid_emission_factor_kg_per_kwh(override: Optional[float] = None) -> Optional[float]:
    if override is not None:
        if override < 0:
            raise ValueError("grid emission factor must be non-negative")
        return override
    raw = load_factors().get("electricity_grid", {}).get("factor_kg_co2e_per_kwh")
    if raw is None:
        return None
    return float(raw)


def electricity_emissions_kg(kwh: float, override: Optional[float] = None) -> dict[str, Any]:
    factor = grid_emission_factor_kg_per_kwh(override)
    if factor is None:
        return {
            "value": None,
            "unit": "kg CO2e",
            "factor": None,
            "is_estimate": True,
            "calculated": False,
            "note": "Electricity emissions not calculated: no verified CEA Combined Margin is stored. Paste a factor in Settings from https://cea.nic.in/cdm-co2-baseline-database/?lang=en",
        }
    return {
        "value": round(kwh * factor, 3),
        "unit": "kg CO2e",
        "factor": factor,
        "is_estimate": True,
        "calculated": True,
        "note": "Modelled estimate using the configured grid factor. Not a measured reduction.",
    }
