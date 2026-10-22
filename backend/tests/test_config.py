from app.core.config import _load_cors_origins


def test_cors_origins_accepts_plural_variable(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example, https://admin.example/")
    monkeypatch.setenv("CORS_ORIGIN", "https://legacy.example")

    assert _load_cors_origins() == [
        "https://app.example",
        "https://admin.example",
    ]


def test_cors_origins_accepts_singular_variable(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.setenv("CORS_ORIGIN", "https://app.example/")

    assert _load_cors_origins() == ["https://app.example"]
