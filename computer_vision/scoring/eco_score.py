"""Evidence-aware photo action opportunities; never an environmental impact score."""
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
    """Summarize mapped guidance areas without assigning an environmental score."""
    confirmed = [o for o in observations if o.get("status") in {"confirmed", "corrected"}]
    reviewed = [o for o in observations if o.get("status") in {"confirmed", "corrected", "dismissed"}]
    review_coverage = len(reviewed) / len(observations) if observations else 0.0
    categories: set[str] = set()
    for observation in observations:
        if observation.get("status") not in {"detected", "confirmed", "corrected"}:
            continue
        category = observation.get("sustainability_category", "Unmapped / needs confirmation")
        if not isinstance(category, str) or not category.strip() or category == "Unmapped / needs confirmation":
            continue
        categories.add(category)

    contributions = [{"category": category} for category in sorted(categories)]
    local_action_by_category = {
        "Reusable vs disposable": (
            "Telangana civic-action cue: check your own municipality's current wet/dry segregation "
            "instructions before disposal. The photo cannot identify material or local recyclability."
        ),
        "Paper and resources": (
            "Telangana civic-action cue: check your own municipality's current paper and dry-waste "
            "instructions before disposal; the image cannot verify local acceptance."
        ),
        "Water use": (
            "Check the tap or fixture for leaks and compare a real water reading; a photo cannot "
            "measure flow or water savings."
        ),
        "Transport": (
            "For a regular Hyderabad trip, compare the actual route and safety of public/shared "
            "transport, cycling, or walking. A vehicle photo does not show travel habits or savings."
        ),
        "Electronics and energy": (
            "Check the appliance's BEE label and, if available, a measured electricity record; "
            "appearance cannot reveal energy use."
        ),
        "Kitchen appliances": (
            "Check the appliance's BEE label and measured use before considering replacement; "
            "a photo cannot establish efficiency."
        ),
        "Kitchen and food": (
            "Plan meals and store food well to avoid waste; the image alone cannot tell whether "
            "food is being wasted."
        ),
        "Furniture and durability": (
            "Before replacing furniture, check its condition and local repair or reuse options; "
            "the image cannot establish either."
        ),
        "Textiles": (
            "Before replacing the item, check its condition and local repair or reuse options; "
            "the image cannot determine its material."
        ),
    }
    local_action = next(
        (
            local_action_by_category[category]
            for category in sorted(categories)
            if category in local_action_by_category
        ),
        (
            "Choose a detected item, confirm its condition, then check current local options before "
            "acting. The photo does not establish environmental impact."
        ) if categories else "",
    )
    return {
        "score": None,
        "max_score": None,
        "guidance_area_count": len(contributions),
        "is_reliable": False,
        "assessment_status": "action_opportunities_identified" if contributions else "no_action_opportunities_detected",
        "label": "Photo guidance summary",
        "confirmed_observation_count": len(confirmed),
        "review_coverage": round(review_coverage, 2),
        "contributions": contributions,
        "local_action": local_action,
        "formula": (
            "Guidance area count = number of distinct mapped guidance categories among active "
            "detections (detected, confirmed, or corrected). Duplicate objects in one category count "
            "once. This is a guidance count, not an environmental score or rating."
        ),
        "limitations": [
            *rules.get("limitations", []),
            "The guidance area count is not an eco-rating: more areas do not mean the scene is greener.",
            "Zero means no mapped guidance area was recognized, not that the scene is environmentally poor.",
            "Local action cues are prompts to verify current local guidance; they do not certify services or disposal rules.",
        ],
    }
