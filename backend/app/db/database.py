"""
EcoPath.AI — Database Configuration
Uses SQLAlchemy with SQLite for local development.
PostgreSQL is supported for production by changing DATABASE_URL.
"""

from sqlalchemy import create_engine, inspect, text
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


def ensure_workspace_owner_column(bind=engine):
    columns = {column["name"] for column in inspect(bind).get_columns("workspaces")}
    with bind.begin() as connection:
        if "owner_id" not in columns:
            connection.execute(
                text("ALTER TABLE workspaces ADD COLUMN owner_id VARCHAR(64)")
            )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_workspaces_owner_id ON workspaces (owner_id)")
        )


def init_db():
    """Create all tables. Called from init_db.py script."""
    from app.models import (  # noqa: F401
        workspace, resource_record, knowledge_article,
        recommendation_rule, action_plan, eco_assessment,
        comparison, org
    )
    Base.metadata.create_all(bind=engine)
    ensure_workspace_owner_column()
    print(f"[OK] Database initialized: {settings.database_url}")
