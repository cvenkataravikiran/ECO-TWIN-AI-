# EcoPath.AI — Product Overview

## Vision

EcoPath.AI is a Sustainability Decision and Action Platform for individuals, households, small businesses, colleges, and institutions.

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
Sustainability workspace with monthly spend, active-action, and savings overview cards; cross-resource trends indexed to each category's first recorded period; concise next actions; and quick navigation.

### Resources & Expenses
Full CRUD tracker for electricity, water, gas, travel, food, waste, and shopping. Supports measured, estimated, and imported data. CSV export.

### Action Planner
Personalized recommendations ranked by priority score and triggered by resource inputs or selected goals. Recommendation cards lead with a concise next step and the input basis; expanded details retain the relevance explanation, knowledge-base guidance, implementation steps, formula, assumptions, and confidence level. Estimates appear only when supported by available data. Users can add actions to the plan, track status changes, and record user-reported results.

### Compare Before You Change
Side-by-side comparison tool with 4 built-in scenarios: Lighting (LED vs CFL vs Incandescent), Commute (Car vs Cycling vs Public Transport), Containers (Reusable vs Disposable), Water (Standard vs Low-Flow). Live recalculation with transparent formulas.

### Recommendations and Knowledge Guidance
Contextual, deterministic recommendations use eligible workspace measurements and documented guidance. The Dashboard foregrounds concise actions, while the Action Planner retains supporting rationale, knowledge guidance, implementation steps, and calculation details. Relevant guidance is also surfaced in Resources, Compare, Circular Living, and Eco-Scorer, next to the task it supports; there is no separate article-browsing screen.

### Circular Living Finder
Waste hierarchy guidance: Maintain → Repair → Reuse → Donate → Recycle → Dispose. Pre-built guidance for common items.

### Eco-Scorer
Optional local computer vision. When the YOLOX-Tiny ONNX model is installed, upload or capture an image, detect supported COCO objects, and confirm, correct, or dismiss observations. The photo guidance summary counts distinct mapped guidance topics; it is not an Eco Score or environmental performance rating. The Environmental Evidence Profile displays the latest saved workspace resource records separately and reports emissions or recyclability as unassessed when required verified factors or material/local-rule evidence is missing. It does not combine unlike data into a misleading overall grade. Telangana action cues encourage checking current local guidance without claiming that materials are recyclable or that services are available. Users confirm observations before saving related actions to the Action Planner. On mobile, **Take a photo** opens the device camera capture directly. The live browser-camera control is currently hidden; its implementation is retained.

### Impact Ledger
Tracks estimated vs actual impact of completed actions. Highlights verified results vs projections.

### Reports & Export
CSV export for resources, actions, and impact data. Structured report generation.
