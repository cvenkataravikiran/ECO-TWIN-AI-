# EcoPath.AI — Project Audit

**Audit date:** 16 October 2026  
**Method:** Full repository inspection of frontend, backend, knowledge base, computer vision, scripts, tests, and documentation. Features were judged by executable behaviour (API calls, persistence, inference), not by the existence of pages or README status badges.

The README marks most pages as “Working”. That is **not** supported by the code. The frontend never calls `/api`. Computer vision never runs a model. Knowledge-base JSON files do not exist.

## Executive answers

| Question | Finding |
|----------|---------|
| 1. What currently works? | React routes and a polished CSS-module UI; FastAPI routers and SQLAlchemy models; deterministic energy/transport/food calculation functions with pytest coverage; Vite `/api` proxy (unused). |
| 2. What is hardcoded or simulated? | Almost all UI KPIs, charts, recommendations, knowledge articles, impact entries, Eco-Scorer detections, PDF “generation”, Settings save, and workspace lists. |
| 3. Do frontend and backend communicate? | **No.** Zero `fetch`/`axios` usage in `frontend/src`. Proxy exists but no client uses it. |
| 4. Do records persist? | Backend CRUD can persist to SQLite **if** the API is called. The UI stores resources/actions in React state and reloads sample data on refresh. Workspaces API returns an in-memory list, ignoring the `workspaces` table. |
| 5. Do calculations use documented inputs and factors? | Calculation **modules** document formulas. UI Compare/Planner use client-side EUR sample tariffs and EU-style emission factors. Grid factor `0.25 kg CO₂e/kWh` is a European sample, not CEA. |
| 6. Does the CV model genuinely run? | **No.** No ONNX weights, no inference package installed (commented out), Eco-Scorer UI uses `setTimeout` + `MOCK_DETECTIONS`. Backend `/analyse` always returns the same five mock objects even if a model file were present. |
| 7. What must be fixed first? | (1) Connect UI to API with aligned workspace IDs. (2) India/INR localisation and honest demo labels. (3) Persist CRUD. (4) Canonical knowledge-base files. (5) Real local CV or an honest “not operational” state. |

## Stack and structure

| Area | Current | Notes |
|------|---------|-------|
| Frontend | React 19, TypeScript, Vite 8, CSS Modules, Recharts, Lucide, React Router | Not Tailwind/shadcn. Existing design system (ivory + forest green) is worth keeping. |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2, SQLite | PostgreSQL supported via `DATABASE_URL`. Alembic listed in requirements but **no alembic.ini / versions**. |
| Knowledge base | `knowledge_base/README.md` only | Described folders (`articles/`, `calculation_factors/`, etc.) are missing. |
| Computer vision | README + empty `models/` | No detector code. |
| Data | `data/` empty until seed script is run | Seed uses EUR and European sources. |
| Tests | `test_calculations.py`, `test_recommendation_engine.py` (unit); `test_api.py` requires a live server | No TestClient, no CV tests, no resource CRUD tests, no frontend tests. |
| Design | Custom tokens in `frontend/src/index.css` | Distinctive; keep rather than replace with a generic SaaS template. |

### Workspace ID mismatch (would break wiring)

| Layer | Personal ID | Business ID |
|-------|-------------|-------------|
| Frontend `sampleData.ts` | `ws-personal-1` | `ws-business-1` |
| Backend seed / workspaces constant | `ws-personal-001` | `ws-business-001` |

## Feature-by-feature status

| Feature | Current implementation | Status | Evidence | Required correction |
|---------|------------------------|--------|----------|---------------------|
| Dashboard | KPIs/charts from `sampleResourceRecords` / `sampleRecommendations`; “Oct 2024” hardcoded | **Mocked** | `Dashboard.tsx` imports sample data; no API | Load workspace records and actions from API; empty state when none; INR; label demo |
| Resources CRUD | Modal + local `useState` seeded from samples; CSV export is client-side | **Partial (UI only)** | `Resources.tsx` `setRecords`; no fetch | Persist via `/api/resources`; CSV import; default INR, kL, km |
| Resource backend | FastAPI CRUD + CSV export | **Real (API unused)** | `backend/app/api/resources.py` | Default currency INR; add CSV import + validation |
| Action Planner | Local state; sample recommendations; status transitions do not persist | **Mocked** | `ActionPlanner.tsx` `useState(sampleActions)` | Generate recs from engine using resource totals; persist actions |
| Recommendation engine | Deterministic Python rules | **Real (unused by UI)** | `engine.py` + tests | India defaults; no invented CO₂ without configured factor; load steps from KB |
| Compare | ~2,200-line client calculator, EUR defaults, localStorage-style saved list in component state | **Partial** | `Compare.tsx` `formatEur`, €/kWh | Recalculate via `/api/comparisons/calculate`; persist comparisons; INR; Indian modes (Metro, bus, train) |
| Comparisons API | Lighting/commute/containers/water | **Partial** | Euro prices; EU 0.25 kg/kWh | Configurable factors; more modes; save/list endpoints |
| Knowledge UI | Filters `sampleKnowledgeArticles` (UK/EU sources) | **Mocked** | `Knowledge.tsx` | Load `/api/knowledge`; India-relevant verified/unverified articles |
| Knowledge API | Search/filter DB articles | **Partial** | Works only after seed; no file import | JSON/YAML files as canonical source + import script |
| Circular Living | Hardcoded item guidance (EU charities, €20 tailor) | **Partial / mocked data** | `CircularLiving.tsx` `itemGuidance` | India/Hyderabad-relevant **generic** guidance; no invented local facilities; CPCB-linked waste hierarchy as unverified until checked |
| Eco-Scorer UI | Upload/preview real; analyse is timeout + mock boxes | **Simulated** | `MOCK_DETECTIONS`; “Analysing with YOLOX-Tiny” | POST image; show real detections or refuse; confirm/correct via API |
| Eco-Scorer API | Validates type/size; always `_mock_detections()` | **Simulated (misleading)** | Commented real inference; `is_demo` only if file missing | Run ONNX locally or return 503; never mock while claiming analysis |
| CV model | Not present; onnxruntime not in requirements | **Missing** | `computer_vision/README.md`; commented deps | Download script, Apache-licensed model, inference module, tests |
| Impact Ledger UI | `sampleImpactEntries`; all `actualValue: null` | **Mocked** | `Impact.tsx` | Derive from persisted actions; separate estimated vs actual |
| Impact API | Maps actions with status completed/in-progress | **Partial (unused)** | `impact.py` | Align with UI fields; do not sum estimates as actuals |
| Reports PDF | `setTimeout` then “generated” | **Simulated** | `Reports.tsx` `handleGenerate` | Server-side PDF from DB records |
| Reports CSV | Client CSV of sample data; backend CSV unused | **Partial** | Two parallel implementations | Call backend export |
| Reports API generate | JSON stub | **Missing PDF** | `reports.py` | reportlab/fpdf; include assumptions |
| Settings | Save sets a toast; currency/name not applied globally | **Nonfunctional** | `Settings.tsx` `handleSave` | Persist display prefs; demo reset that reseeds DB |
| Workspaces | Frontend sample list; API hardcoded `DEMO_WORKSPACES` | **Mocked** | `workspaces.py` does not query DB | CRUD from `workspaces` table; demo flag |
| Auth / scoping | None. Query `workspace_id` optional; listing all records if omitted | **Missing** | Any client can read all workspaces | Require workspace id; document local-demo auth limits |
| India localisation | EUR, en-IE/en-US, European sources | **Missing** | Default currency EUR in schemas and UI | INR, en-IN grouping, km/kWh/kL/°C, Hyderabad context |
| Dummy data labelling | Some comments say SAMPLE DATA; dashboard presents figures as workspace facts | **Misleading** | Dashboard notice says values are “from your resource records” | Banner “Demonstration data”; reset; empty states |
| Tests | Calcs + recs good; API needs live server | **Partial** | `test_api.py` skips if port 8000 down | TestClient; import/CSV; CV validation; compare; auth |
| README accuracy | Claims 10 pages working including Eco-Scorer “Working (mock)” and Reports working | **Overstated** | README Features table | Rewrite to match this audit |

## Hardcoded / simulated inventory

- `frontend/src/services/sampleData.ts` — all demo records (EUR).
- `EcoScorer.tsx` `MOCK_DETECTIONS`.
- `eco_scorer.py` `_mock_detections()` used on every analyse.
- `workspaces.py` `DEMO_WORKSPACES`.
- `reports.py` `generate_report()` stub; frontend fake PDF delay.
- `engine.py` water rule uses hardcoded `9.50` EUR savings and `14.0` kg CO₂e.
- Compare defaults: €0.15/kWh, €1.80/L petrol, EU emission text.
- Knowledge articles cite Energy Saving Trust, WRAP, ECF, Waterwise, EEA — not India-first.

## Highest-priority fix order (this build)

1. Audit documented (this file).  
2. Setup: INR, workspace IDs, DB-backed workspaces, `.env.example`, demo labels.  
3. Wire resource tracker, calculations, knowledge files + API.  
4. Action Planner, Compare (backend engine), Impact Ledger persistence.  
5. Genuine local ONNX Eco-Scorer or explicit non-operational state.  
6. PDF/CSV reports, labelled business demo, scoping, tests, README.

## Decision: do not rewrite from scratch

The frontend design system, page layouts, calculation modules, and recommendation engine are salvageable. The gap is **integration, honesty, localisation, and missing CV/KB artefacts** — not an empty repo.
