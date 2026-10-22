import asyncio

from app.core.middleware import NormalizeApiPathMiddleware


def test_normalizes_repeated_slashes_in_api_path():
    captured = {}

    async def app(scope, receive, send):
        captured.update(scope)

    middleware = NormalizeApiPathMiddleware(app)
    scope = {
        "type": "http",
        "path": "/api//eco-scorer//status",
        "raw_path": b"/api//eco-scorer//status",
    }

    asyncio.run(middleware(scope, None, None))

    assert captured["path"] == "/api/eco-scorer/status"
    assert captured["raw_path"] == b"/api/eco-scorer/status"


def test_leaves_non_api_paths_unchanged():
    captured = {}

    async def app(scope, receive, send):
        captured.update(scope)

    middleware = NormalizeApiPathMiddleware(app)
    scope = {"type": "http", "path": "/assets//image.svg"}

    asyncio.run(middleware(scope, None, None))

    assert captured["path"] == "/assets//image.svg"
