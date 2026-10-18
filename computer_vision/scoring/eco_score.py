"""Evidence-only assessment helpers for confirmed visual observations."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_rules(project_root: Path) -> dict[str, Any]:
    path = project_root / "knowledge_base" / "eco_scoring_rules" / "coco_sustainability_map.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def map_class(class_label: str, rules: dict[str, Any]) -> dict[str, Any]:
    mapping = rules.get("class_map", {})
    key = class_label.lower().strip()
    if key in mapping:
        return mapping[key]
    return {
        "category": "Unmapped / needs confirmation",
        "guidance": "This detected label has no mapped sustainability guidance. Confirm its identity or dismiss it.",
    }


def score_observations(observations: list[dict], rules: dict[str, Any]) -> dict[str, Any]:
    """Report review completeness; object presence is not environmental performance evidence."""
    confirmed = [o for o in observations if o.get("status") in {"confirmed", "corrected"}]
    reviewed = [o for o in observations if o.get("status") in {"confirmed", "corrected", "dismissed"}]
    review_coverage = len(reviewed) / len(observations) if observations else 0.0
    categories = sorted({
        o.get("sustainability_category", "Unmapped / needs confirmation")
        for o in confirmed
    })
    return {
        "score": None,
        "max_score": None,
        "is_reliable": False,
        "assessment_status": "incomplete",
        "label": "Environmental score withheld",
        "confirmed_observation_count": len(confirmed),
        "review_coverage": round(review_coverage, 2),
        "contributions": [{"category": category} for category in categories],
        "formula": (
            "No environmental score is calculated from object detections. "
            "Confirmed objects unlock relevant guidance only; environmental impact needs measured or user-supplied evidence."
        ),
        "limitations": rules.get("limitations", []),
    }
