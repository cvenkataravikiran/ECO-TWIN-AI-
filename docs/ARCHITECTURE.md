# EcoTwin AI — Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│  React 19 + TypeScript + Vite + CSS Modules + Recharts       │
│  Port 5173                                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │  HTTP (Vite proxy /api → :8000)
┌─────────────────▼───────────────────────────────────────────┐
│                     BACKEND (FastAPI)                         │
│  10 API route modules + Pydantic validation                  │
│  Port 8000                                                   │
├──────────┬──────────┬──────────┬────────────────────────────┤
│ Calcs    │ Rec Eng  │ CV       │ Knowledge Base              │
│ energy   │ rules    │ YOLOX    │ articles + rules            │
│ transport│ ranking  │ ONNX     │ scoring rules               │
│ food     │ scoring  │ detect   │ sources                     │
└──────────┴──────────┴──────────┴────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                     DATABASE (SQLAlchemy)                     │
│  SQLite (dev) / PostgreSQL (prod)                            │
│  7 tables: workspaces, resource_records, knowledge_articles, │
│  actions, eco_assessments, visual_observations,              │
│  recommendation_rules                                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **User** → Frontend captures resource data, goals, and preferences
2. **Frontend** → API calls to backend endpoints
3. **Backend** → Validates with Pydantic, stores via SQLAlchemy
4. **Recommendation Engine** → Reads user context, applies rules, calls calculation modules
5. **Calculation Modules** → Return documented results with formulas and assumptions
6. **CV Module** → Receives image, runs YOLOX-Tiny, maps detections to sustainability categories
7. **Response** → Structured JSON with transparency metadata

## Separation of Concerns

| Layer | Responsibility | Never Contains |
|-------|---------------|----------------|
| Frontend | Presentation, interaction, local state | DB credentials, business logic |
| API Routes | Request validation, response formatting | Calculations, DB queries |
| Services/Repos | Database queries, data access | Business rules |
| Calculations | Documented formulas | Database access, API concerns |
| Recommendation Engine | Rule evaluation, ranking | Direct DB access |
| Computer Vision | Image processing, detection | Business rules, scoring logic |

## Technology Stack

### Frontend
- React 19 with TypeScript (strict mode)
- Vite 8.x build tool
- CSS Modules with custom property design system
- Recharts for data visualization
- Lucide React for icons
- React Router for navigation

### Backend
- Python 3.13
- FastAPI with Pydantic v2
- SQLAlchemy 2.x ORM
- SQLite (development) / PostgreSQL (production)
- Uvicorn ASGI server

### Computer Vision
- YOLOX-Tiny (Apache 2.0 licence)
- ONNX Runtime for inference
- CPU-only, no GPU required
- ~18-25ms inference time
