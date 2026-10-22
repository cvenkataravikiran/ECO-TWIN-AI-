import asyncio

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app
from app.models import Workspace


@pytest.fixture
def auth_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    with session_factory() as db:
        db.add(Workspace(
            id="ws-existing",
            name="Existing household",
            type="individual",
            is_demo=False,
        ))
        db.commit()

    def override_get_db():
        with session_factory() as db:
            yield db

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        )
        yield client
        asyncio.run(client.aclose())
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()


def test_registration_adopts_existing_workspaces_and_owner_isolation(auth_client):
    async def exercise():
        anonymous = await auth_client.get("/api/workspaces")
        assert anonymous.status_code == 401

        first = await auth_client.post(
            "/api/auth/register",
            json={"email": " FIRST@example.com ", "password": "strong-password-1"},
        )
        assert first.status_code == 201
        assert first.json()["email"] == "first@example.com"
        assert auth_client.cookies.get("ecopath_session")
        cookie_header = first.headers["set-cookie"].lower()
        assert "httponly" in cookie_header
        assert "max-age=2592000" in cookie_header

        workspaces = await auth_client.get("/api/workspaces")
        assert [item["id"] for item in workspaces.json()] == ["ws-existing"]

        created = await auth_client.post(
            "/api/workspaces/",
            json={"name": "My workspace", "type": "individual", "description": ""},
        )
        assert created.status_code == 201
        created_workspace_id = created.json()["id"]
        record = await auth_client.post(
            "/api/resources/",
            json={
                "workspace_id": created_workspace_id,
                "category": "electricity",
                "description": "October electricity bill",
                "quantity": 120,
                "unit": "kWh",
                "cost": 960,
                "currency": "INR",
                "period_start": "2026-10-01",
                "period_end": "2026-10-31",
                "measurement_type": "measured",
            },
        )
        assert record.status_code == 201

        logged_out = await auth_client.post("/api/auth/logout")
        assert logged_out.status_code == 204
        assert (await auth_client.get("/api/workspaces")).status_code == 401

        logged_in = await auth_client.post(
            "/api/auth/login",
            json={"email": "first@example.com", "password": "strong-password-1"},
        )
        assert logged_in.status_code == 200
        assert {
            item["id"] for item in (await auth_client.get("/api/workspaces")).json()
        } == {"ws-existing", created_workspace_id}
        restored_records = await auth_client.get(
            f"/api/resources/?workspace_id={created_workspace_id}"
        )
        assert [item["id"] for item in restored_records.json()["items"]] == [record.json()["id"]]

        second_client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        )
        try:
            second = await second_client.post(
                "/api/auth/register",
                json={"email": "second@example.com", "password": "strong-password-2"},
            )
            assert second.status_code == 201
            assert (await second_client.get("/api/workspaces")).json() == []
            assert (await second_client.get(f"/api/workspaces/{created_workspace_id}")).status_code == 404
            assert (
                await second_client.get(
                    f"/api/resources/?workspace_id={created_workspace_id}"
                )
            ).status_code == 404
        finally:
            await second_client.aclose()

    asyncio.run(exercise())


def test_registration_rejects_weak_password(auth_client):
    response = asyncio.run(auth_client.post(
        "/api/auth/register",
        json={"email": "person@example.com", "password": "short"},
    ))

    assert response.status_code == 422


def test_https_proxy_sets_cross_site_session_cookie(auth_client):
    async def exercise():
        auth_client.base_url = httpx.URL("https://test")
        response = await auth_client.post(
            "/api/auth/register",
            headers={
                "origin": "https://eco-twin-ai-omega.vercel.app",
                "x-forwarded-proto": "https",
            },
            json={"email": "secure@example.com", "password": "strong-password-4"},
        )

        assert response.status_code == 201
        cookie_header = response.headers["set-cookie"].lower()
        assert "secure" in cookie_header
        assert "samesite=none" in cookie_header
        assert response.headers["access-control-allow-origin"] == "https://eco-twin-ai-omega.vercel.app"
        assert response.headers["access-control-allow-credentials"] == "true"
        assert (await auth_client.get("/api/workspaces")).status_code == 200

    asyncio.run(exercise())


def test_registration_rejects_duplicate_email(auth_client):
    async def exercise():
        credentials = {"email": "person@example.com", "password": "strong-password-3"}
        assert (await auth_client.post("/api/auth/register", json=credentials)).status_code == 201
        duplicate = await auth_client.post("/api/auth/register", json=credentials)
        assert duplicate.status_code == 409

    asyncio.run(exercise())


def test_existing_workspace_schema_is_upgraded_without_losing_rows():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE workspaces (id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO workspaces (id, name) VALUES ('legacy', 'Existing home')"
        )

    from app.db.database import ensure_workspace_owner_column
    from sqlalchemy import inspect, text

    ensure_workspace_owner_column(engine)

    with engine.connect() as connection:
        columns = {column["name"] for column in inspect(engine).get_columns("workspaces")}
        workspace = connection.execute(
            text("SELECT id, name, owner_id FROM workspaces WHERE id = 'legacy'")
        ).one()
        assert "owner_id" in columns
        assert workspace == ("legacy", "Existing home", None)

    engine.dispose()
