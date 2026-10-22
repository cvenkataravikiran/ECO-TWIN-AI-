from app.core.config import _load_cors_origins
from app.db.database import _normalize_database_url


def test_cors_origins_combines_plural_and_singular_variables(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example, https://admin.example/")
    monkeypatch.setenv("CORS_ORIGIN", "https://legacy.example")

    assert _load_cors_origins() == [
        "https://app.example",
        "https://admin.example",
        "https://legacy.example",
        "https://eco-twin-ai-omega.vercel.app",
    ]


def test_cors_origins_accepts_singular_variable(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.setenv("CORS_ORIGIN", "https://app.example/")

    assert _load_cors_origins() == [
        "https://app.example",
        "https://eco-twin-ai-omega.vercel.app",
    ]


def test_cors_origins_defaults_to_local_development_origins(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("CORS_ORIGIN", raising=False)

    assert _load_cors_origins() == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://eco-twin-ai-omega.vercel.app",
    ]


def test_postgres_urls_use_the_installed_psycopg_driver():
    assert (
        _normalize_database_url("postgres://user:pass@host/db")
        == "postgresql+psycopg://user:pass@host/db"
    )
    assert (
        _normalize_database_url("postgresql://user:pass@host/db")
        == "postgresql+psycopg://user:pass@host/db"
    )
    assert _normalize_database_url("sqlite:///data/app.db") == "sqlite:///data/app.db"
