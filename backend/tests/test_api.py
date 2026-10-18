"""
EcoTwin AI — API Integration Tests
Uses httpx directly to test running server endpoints.
"""
import pytest
import httpx

BASE = "http://localhost:8000"


@pytest.fixture(scope="module")
def client():
    """HTTP client for API tests. Requires server running on port 8000."""
    with httpx.Client(base_url=BASE, timeout=10) as c:
        # Check server is running
        try:
            c.get("/api/health")
        except httpx.ConnectError:
            pytest.skip("Backend server not running on port 8000")
        yield c


class TestHealth:
    def test_health_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestWorkspaces:
    def test_list(self, client):
        r = client.get("/api/workspaces/")
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_get(self, client):
        r = client.get("/api/workspaces/ws-personal-001")
        assert r.status_code == 200
        assert r.json()["name"] == "My Household"

    def test_not_found(self, client):
        r = client.get("/api/workspaces/nonexistent")
        assert r.status_code == 404


class TestRecommendations:
    def test_generate(self, client):
        r = client.post("/api/recommendations/generate", json={
            "monthly_electricity_kwh": 268,
            "monthly_grocery_spend": 420,
            "goals": ["reduce-costs"],
        })
        assert r.status_code == 200
        d = r.json()
        assert d["engine"] == "deterministic-rule-based"
        assert d["total"] >= 3

    def test_rules(self, client):
        r = client.get("/api/recommendations/rules")
        assert r.status_code == 200
        assert r.json()["total"] >= 5


class TestComparisons:
    def test_lighting_requires_measured_inputs(self, client):
        r = client.post("/api/comparisons/calculate", json={
            "scenario": "lighting",
            "inputs": {"price_per_kwh": 8.5},
        })
        assert r.status_code == 200
        assert r.json()["calculated"] is False
        assert set(r.json()["missing"]) == {"num_bulbs", "hours_per_day"}

    def test_lighting(self, client):
        r = client.post("/api/comparisons/calculate", json={
            "scenario": "lighting",
            "inputs": {"num_bulbs": 10, "hours_per_day": 5, "price_per_kwh": 8.5},
        })
        assert r.status_code == 200
        d = r.json()
        assert len(d["options"]) == 3
        costs = {o["name"]: o["annual_cost"] for o in d["options"]}
        assert costs["LED"] < costs["Incandescent"]

    def test_commute_requires_user_costs(self, client):
        r = client.post("/api/comparisons/calculate", json={
            "scenario": "commute",
            "inputs": {"distance_km": 10, "days_per_week": 5},
        })
        assert r.status_code == 200
        data = r.json()
        assert data["calculated"] is True
        assert all(option["monthly_cost"] is None for option in data["options"])
        assert "emissions" not in data

    def test_commute_uses_only_entered_costs(self, client):
        r = client.post("/api/comparisons/calculate", json={
            "scenario": "commute",
            "inputs": {
                "distance_km": 10,
                "days_per_week": 5,
                "car_cost_per_km": 12,
                "bike_maintenance_monthly": 150,
            },
        })
        assert r.status_code == 200
        options = {option["name"]: option for option in r.json()["options"]}
        assert options["Car"]["monthly_cost"] == 2598
        assert options["Cycle"]["monthly_cost"] == 150
        assert options["City bus"]["monthly_cost"] is None


class TestReports:
    def test_generate(self, client):
        r = client.post("/api/reports/generate")
        assert r.status_code == 200
