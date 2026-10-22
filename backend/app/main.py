"""EcoPath.AI FastAPI backend entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.middleware import NormalizeApiPathMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup if they don't exist."""
    from app.db.database import SessionLocal, init_db
    from app.services.knowledge_import import upsert_articles

    init_db()
    db = SessionLocal()
    try:
        upsert_articles(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="EcoPath.AI API",
    description="Sustainability Decision and Action Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS — in production, restrict to your frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(NormalizeApiPathMiddleware)

# Include routers
from app.api import (
    actions,
    auth,
    comparisons,
    eco_scorer,
    health,
    impact,
    knowledge,
    recommendations,
    reports,
    resources,
    workspaces,
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["Workspaces"])
app.include_router(resources.router, prefix="/api/resources", tags=["Resources"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["Recommendations"])
app.include_router(actions.router, prefix="/api/actions", tags=["Actions"])
app.include_router(comparisons.router, prefix="/api/comparisons", tags=["Comparisons"])
app.include_router(impact.router, prefix="/api/impact", tags=["Impact Ledger"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(eco_scorer.router, prefix="/api/eco-scorer", tags=["Eco-Scorer"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["Knowledge Guidance"])


@app.get("/")
def root():
    return {"message": "EcoPath.AI API", "docs": "/api/docs"}
