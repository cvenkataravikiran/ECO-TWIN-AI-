# EcoTwin AI — Product Overview

## Vision

EcoTwin AI is a Sustainability Decision and Action Platform for individuals, households, small businesses, colleges, and institutions.

The platform connects these steps in one coherent workflow:

**OBSERVE → UNDERSTAND → IDENTIFY → COMPARE → DECIDE → ACT → MEASURE → IMPROVE**

## Core Promise

> "Understand your impact. Find your next best action. Measure what changes."

## What Makes It Different

1. **Integrated workflow** — Not just a calculator, but a complete decision-to-action-to-verification pipeline.
2. **Transparent calculations** — Every estimate shows its formula, assumptions, data sources, and confidence level.
3. **Personal context** — Recommendations adapt to user's workspace type, consumption data, goals, and budget.
4. **Optional computer vision** — When locally installed, Eco-Scorer runs YOLOX-Tiny COCO object detection and retrieves mapped knowledge-base guidance after user confirmation. It does not infer environmental performance from photographs.
5. **No generative AI** — All logic is deterministic, rule-based, and auditable. No chatbots, no hallucinated data.
6. **Honest about uncertainty** — Clearly separates measured data from estimates. Labels sample data as sample data.

## Target Users

| User Type | Use Case |
|-----------|----------|
| Individual | Track personal resource use, find savings opportunities |
| Household | Monitor utility bills, plan sustainability actions |
| Small Business | Compare operational alternatives, track impact |
| College/Institution | Campus sustainability programme dashboard |

## Feature Set

### Dashboard
Premium sustainability workspace with real-time overview cards, resource trends chart, next best actions, and quick navigation.

### Resources & Expenses
Full CRUD tracker for electricity, water, gas, travel, food, waste, and shopping. Supports measured, estimated, and imported data. CSV export.

### Action Planner
Personalized recommendations ranked by priority score. Each recommendation shows relevance explanation, estimated savings, environmental benefit, implementation steps, formula, assumptions, and confidence level. Users can add to plan, track status changes, and record actual results.

### Compare Before You Change
Side-by-side comparison tool with 4 built-in scenarios: Lighting (LED vs CFL vs Incandescent), Commute (Car vs Cycling vs Public Transport), Containers (Reusable vs Disposable), Water (Standard vs Low-Flow). Live recalculation with transparent formulas.

### Recommendations
Contextual, deterministic recommendations use workspace measurements and curated internal guidance. Users see why each recommendation applies and which data or measurements are still missing; the internal article library is not exposed as a separate browsing page.

### Circular Living Finder
Waste hierarchy guidance: Maintain → Repair → Reuse → Donate → Recycle → Dispose. Pre-built guidance for common items.

### Eco-Scorer
Optional local computer vision. When the YOLOX-Tiny ONNX model is installed, upload or capture an image, detect supported COCO objects, and confirm, correct, or dismiss observations. Confirmed mapped observations retrieve curated knowledge-base guidance that can be saved to the Action Planner. The app withholds a numerical environmental score because a photo cannot establish lifecycle emissions, actual electricity use, product composition, or recyclability.

### Impact Ledger
Tracks estimated vs actual impact of completed actions. Highlights verified results vs projections.

### Reports & Export
CSV export for resources, actions, and impact data. Structured report generation.
