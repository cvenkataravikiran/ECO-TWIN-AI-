"""
EcoTwin AI — Database Configuration
Uses SQLAlchemy with SQLite for local development.
PostgreSQL is supported for production by changing DATABASE_URL.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

# SQLite connection args (needed for SQLite only)
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Called from init_db.py script."""
    from app.models import (  # noqa: F401
        workspace, resource_record, knowledge_article,
        recommendation_rule, action_plan, eco_assessment,
        comparison, org
    )
    Base.metadata.create_all(bind=engine)
    print(f"[OK] Database initialized: {settings.database_url}")
