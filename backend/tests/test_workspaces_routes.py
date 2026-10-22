import asyncio

import httpx

from app.db.database import get_db
from app.main import app


def test_workspace_list_supports_paths_with_and_without_trailing_slash():
    get_paths = {
        route.path
        for route in app.routes
        if "GET" in getattr(route, "methods", set())
    }

    assert "/api/workspaces" in get_paths
    assert "/api/workspaces/" in get_paths


def test_repeated_slashes_reach_workspace_list_without_redirect():
    class EmptyWorkspaceQuery:
        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def all(self):
            return []

    class EmptyWorkspaceDatabase:
        def query(self, *_args):
            return EmptyWorkspaceQuery()

    def override_get_db():
        yield EmptyWorkspaceDatabase()

    async def make_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
            follow_redirects=False,
        ) as client:
            return await client.get("/api//workspaces")

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    try:
        response = asyncio.run(make_request())
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override

    assert response.status_code == 401
