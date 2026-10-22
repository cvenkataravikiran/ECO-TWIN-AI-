import asyncio
import re
import zlib

import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.actions import (
    ActionCreate,
    ActionUpdate,
    create_action,
    delete_action,
    get_action,
    list_actions,
    update_action,
)
from app.api.comparisons import ComparisonInput, calculate_comparison, list_comparisons
from app.api.eco_scorer import (
    analyse_image,
    delete_assessment,
    list_assessments,
    save_to_planner,
    update_observation,
    ObservationUpdate,
)
from app.api.impact import list_impact_entries
from app.api.knowledge import list_articles
from app.api.recommendations import RecommendationRequest, generate as generate_recommendation_api
from app.api.reports import export_csv, generate_pdf, generate_report_alias
from app.api.resources import (
    ResourceRecordCreate,
    ResourceRecordUpdate,
    create_resource,
    list_resources,
    update_resource,
)
from app.api.workspaces import WorkspaceCreate, create_workspace, delete_workspace, list_workspaces
from app.db.database import Base
from app.models import ResourceRecord, Workspace
from app.models.action_plan import Action
from app.models.comparison import SavedComparison
from app.models.eco_assessment import EcoAssessment, VisualObservation
from app.services.knowledge_import import upsert_articles


def test_category_guidance_api_is_mounted_and_filters_knowledge_articles(db_session):
    from app.main import app

    assert any(
        route.path == "/api/knowledge/" and "GET" in route.methods
        for route in app.routes
    )
    upsert_articles(db_session)

    result = list_articles(
        search=None,
        category="home-energy",
        audience=None,
        page=1,
        size=2,
        db=db_session,
    )

    assert result["total"] >= 2
    assert len(result["items"]) == 2
    assert all(article["category"] == "home-energy" for article in result["items"])
    assert all(article["implementation_steps"] for article in result["items"])


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_live_workspace_creation_excludes_demo_workspaces(db_session):
    db_session.add(Workspace(
        id="ws-presentation",
        name="Presentation",
        type="individual",
        is_demo=True,
    ))
    db_session.commit()

    created = create_workspace(
        WorkspaceCreate(name="  My Home ", type="individual", description=""),
        db_session,
    )
    listed = list_workspaces(db_session)

    assert created["name"] == "My Home"
    assert created["is_demo"] is False
    assert [item["id"] for item in listed] == [created["id"]]


def test_sustainability_pdf_download_filters_by_selected_period(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="October Home", type="individual"),
        db_session,
    )
    db_session.add_all([
        ResourceRecord(
            id="res-period-overlap",
            workspace_id=workspace["id"],
            category="electricity",
            description="Included interval resource",
            quantity=100,
            unit="kWh",
            cost=700,
            currency="INR",
            period_start="2026-09-25",
            period_end="2026-10-05",
            measurement_type="measured",
        ),
        ResourceRecord(
            id="res-outside-period",
            workspace_id=workspace["id"],
            category="electricity",
            description="Outside date range resource",
            quantity=90,
            unit="kWh",
            cost=600,
            currency="INR",
            period_start="2026-09-01",
            period_end="2026-09-30",
            measurement_type="measured",
        ),
        Action(
            id="act-period-in",
            workspace_id=workspace["id"],
            title="Included period action",
            category="home-energy",
            status="completed",
            planned_date="2026-10-03",
            completed_date="2026-10-12",
            initial_estimate_amount=500,
            actual_savings_amount=350,
        ),
        Action(
            id="act-period-out",
            workspace_id=workspace["id"],
            title="Outside period action",
            category="home-energy",
            status="planned",
            planned_date="2026-10-18",
        ),
    ])
    db_session.commit()

    response = generate_pdf(
        workspace["id"],
        "2026-10-01",
        "2026-10-17",
        db_session,
        include_estimates=False,
    )

    async def read_response_body():
        return b"".join([chunk async for chunk in response.body_iterator])

    pdf_bytes = asyncio.run(read_response_body())
    pdf_streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", pdf_bytes, re.DOTALL)
    decoded_streams = []
    for stream in pdf_streams:
        try:
            decoded_streams.append(zlib.decompress(stream))
        except zlib.error:
            decoded_streams.append(stream)
    pdf = b"\n".join(decoded_streams).decode("latin-1")
    assert pdf_bytes.startswith(b"%PDF-")
    assert response.media_type == "application/pdf"
    assert "attachment;" in response.headers["content-disposition"]
    assert "2026-10-01" in response.headers["content-disposition"]
    assert "Included interval resource" in pdf
    assert "Outside date range resource" not in pdf
    assert "Included period action" in pdf
    assert "Outside period action" not in pdf
    assert "planned estimate=not included" in pdf
    assert "user-reported actual savings=350.0 INR" in pdf


def test_sustainability_pdf_rejects_invalid_date_range(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Date Validation Home", type="individual"),
        db_session,
    )

    with pytest.raises(HTTPException) as error:
        generate_pdf(
            workspace["id"],
            "2026-10-18",
            "2026-10-17",
            db_session,
        )

    assert error.value.status_code == 400


def test_resources_persist_only_inr_and_exclude_demo_workspaces(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Real workspace", type="individual"),
        db_session,
    )
    record = create_resource(ResourceRecordCreate(
        workspace_id=workspace["id"],
        category="electricity",
        description="Electricity bill",
        quantity=120,
        unit="kWh",
        cost=840,
        currency="INR",
        period_start="2026-09-01",
        period_end="2026-09-30",
        measurement_type="measured",
    ), db_session)

    listing = list_resources(
        workspace_id=workspace["id"],
        category=None,
        measurement_type=None,
        page=1,
        size=20,
        db=db_session,
    )
    assert record["currency"] == "INR"
    assert listing["items"][0]["id"] == record["id"]

    with pytest.raises(ValidationError, match="Only INR"):
        ResourceRecordCreate(
            workspace_id=workspace["id"],
            category="electricity",
            description="Foreign currency",
            quantity=120,
            unit="kWh",
            cost=10,
            currency="EUR",
            period_start="2026-09-01",
            period_end="2026-09-30",
            measurement_type="measured",
        )


def test_legacy_currency_requires_verified_inr_amount_for_correction(db_session):
    workspace = Workspace(id="ws-live", name="Live", type="individual", is_demo=False)
    db_session.add(workspace)
    legacy = ResourceRecord(
        id="res-legacy",
        workspace_id=workspace.id,
        category="electricity",
        description="Legacy record",
        quantity=20,
        unit="kWh",
        cost=2,
        currency="EUR",
        period_start="2026-09-01",
        period_end="2026-09-30",
        measurement_type="measured",
    )
    db_session.add(legacy)
    db_session.commit()

    with pytest.raises(Exception, match="verified rupee amount"):
        update_resource("res-legacy", ResourceRecordUpdate(notes="unrelated edit"), db_session)

    updated = update_resource(
        "res-legacy",
        ResourceRecordUpdate(cost=200, currency="INR"),
        db_session,
    )
    assert updated["currency"] == "INR"
    assert updated["cost"] == 200


def test_recommendations_use_latest_measured_individual_workspace_electricity(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Individual Home", type="individual"),
        db_session,
    )
    db_session.add(ResourceRecord(
        id="res-old-month",
        workspace_id=workspace["id"],
        category="electricity",
        description="Older bill",
        quantity=50,
        unit="kWh",
        cost=300,
        currency="INR",
        period_start="2026-08-01",
        period_end="2026-08-31",
        measurement_type="measured",
    ))
    db_session.add(ResourceRecord(
        id="res-latest-month",
        workspace_id=workspace["id"],
        category="electricity",
        description="Latest bill",
        quantity=150,
        unit="kWh",
        cost=1200,
        currency="INR",
        period_start="2026-09-01",
        period_end="2026-09-30",
        measurement_type="measured",
    ))
    db_session.add(ResourceRecord(
        id="res-estimated-month",
        workspace_id=workspace["id"],
        category="electricity",
        description="Estimated entry",
        quantity=900,
        unit="kWh",
        cost=9000,
        currency="INR",
        period_start="2026-09-01",
        period_end="2026-09-30",
        measurement_type="estimated",
    ))
    db_session.commit()
    upsert_articles(db_session)

    result = generate_recommendation_api(
        RecommendationRequest(
            workspace_id=workspace["id"],
            monthly_electricity_kwh=5,
        ),
        db_session,
    )
    recommendations = {item["id"]: item for item in result["recommendations"]}

    assert {"rec-001", "rec-002"} <= recommendations.keys()
    assert recommendations["rec-001"]["relevance_explanation"] == (
        "Your recorded electricity consumption is 150 kWh/month. Reviewing lamp wattages "
        "and operating hours may identify opportunities to reduce use."
    )

    demo = Workspace(id="ws-recommendation-demo", name="Demo", type="individual", is_demo=True)
    db_session.add(demo)
    db_session.commit()
    with pytest.raises(HTTPException) as error:
        generate_recommendation_api(RecommendationRequest(workspace_id=demo.id), db_session)
    assert error.value.status_code == 404


def test_empty_workspace_has_no_default_recommendations(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Empty Recommendation Workspace", type="individual"),
        db_session,
    )

    result = generate_recommendation_api(
        RecommendationRequest(workspace_id=workspace["id"]),
        db_session,
    )

    assert result["recommendations"] == []
    assert result["total"] == 0


def test_deleting_workspace_removes_its_data_and_preserves_other_workspaces(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Workspace to delete", type="individual"),
        db_session,
    )
    other_workspace = create_workspace(
        WorkspaceCreate(name="Workspace to keep", type="individual"),
        db_session,
    )
    db_session.add(ResourceRecord(
        id="res-delete-workspace",
        workspace_id=workspace["id"],
        category="water",
        description="Measured water",
        quantity=100,
        unit="L",
        cost=0,
        currency="INR",
        period_start="2026-09-01",
        period_end="2026-09-30",
        measurement_type="measured",
    ))
    db_session.add(Action(
        id="action-delete-workspace",
        workspace_id=workspace["id"],
        title="Test action",
        category="water-nature",
        status="planned",
        planned_date="2026-10-01",
    ))
    db_session.add(SavedComparison(
        id="comparison-delete-workspace",
        workspace_id=workspace["id"],
        scenario="water",
        inputs_json="{}",
        result_json="{}",
    ))
    assessment = EcoAssessment(
        id="assessment-delete-workspace",
        workspace_id=workspace["id"],
        image_filename="test.jpg",
        model_id="test-model",
        model_version="1",
        processing_time_ms=1,
    )
    assessment.observations.append(VisualObservation(
        id="observation-delete-workspace",
        class_label="bottle",
        sustainability_category="recyclable",
        confidence=0.9,
        bbox_x=0.1,
        bbox_y=0.1,
        bbox_w=0.5,
        bbox_h=0.5,
    ))
    db_session.add(assessment)
    db_session.commit()

    result = delete_workspace(workspace["id"], db_session)

    assert result == {"deleted": True, "workspace_id": workspace["id"]}
    assert db_session.get(Workspace, workspace["id"]) is None
    assert db_session.query(ResourceRecord).filter_by(workspace_id=workspace["id"]).count() == 0
    assert db_session.query(Action).filter_by(workspace_id=workspace["id"]).count() == 0
    assert db_session.query(SavedComparison).filter_by(workspace_id=workspace["id"]).count() == 0
    assert db_session.query(EcoAssessment).filter_by(workspace_id=workspace["id"]).count() == 0
    assert db_session.get(VisualObservation, "observation-delete-workspace") is None
    assert db_session.get(Workspace, other_workspace["id"]) is not None


def test_demo_workspace_cannot_be_deleted(db_session):
    demo = Workspace(id="ws-demo-protected-delete", name="Demo", type="individual", is_demo=True)
    db_session.add(demo)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        delete_workspace(demo.id, db_session)

    assert error.value.status_code == 404
    assert db_session.get(Workspace, demo.id) is not None


def test_recommendations_use_measured_resource_categories_without_assuming_travel_mode(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Resource Mix Business", type="business"),
        db_session,
    )
    records = [
        ("electricity", 150, "kWh", 1200),
        ("water", 2.5, "kL", 500),
        ("waste", 20, "kg", 0),
        ("travel", 300, "km", 1500),
        ("food", 1, "month", 6000),
        ("shopping", 1, "month", 2500),
    ]
    for index, (category, quantity, unit, cost) in enumerate(records):
        db_session.add(ResourceRecord(
            id=f"res-mix-{index}",
            workspace_id=workspace["id"],
            category=category,
            description=f"Measured {category}",
            quantity=quantity,
            unit=unit,
            cost=cost,
            currency="INR",
            period_start="2026-09-01",
            period_end="2026-09-30",
            measurement_type="measured",
        ))
    db_session.add(ResourceRecord(
        id="res-estimated-water",
        workspace_id=workspace["id"],
        category="water",
        description="Estimated water excluded",
        quantity=999,
        unit="kL",
        cost=0,
        currency="INR",
        period_start="2026-09-01",
        period_end="2026-09-30",
        measurement_type="estimated",
    ))
    db_session.commit()
    upsert_articles(db_session)

    result = generate_recommendation_api(
        RecommendationRequest(workspace_id=workspace["id"]),
        db_session,
    )
    recommendations = {item["id"]: item for item in result["recommendations"]}
    assert {
        "rec-001", "rec-002", "rec-003", "rec-006", "rec-007",
        "rec-008", "rec-009", "rec-010", "rec-011", "rec-012",
        "rec-013", "rec-014", "rec-015",
    } <= recommendations.keys()
    assert "rec-004" not in recommendations
    assert "2500 L" in recommendations["rec-006"]["relevance_explanation"]
    assert recommendations["rec-006"]["input_basis"] == "Water input: 2500 L/month."
    assert recommendations["rec-006"]["next_step"] == (
        "Check the latest water reading and inspect visible fixtures for unexplained changes."
    )
    assert recommendations["rec-007"]["input_basis"] == "Water input: 2500 L/month."
    assert recommendations["rec-007"]["next_step"]
    assert all(item["estimated_monthly_savings"] is None for item in recommendations.values())
    assert all(item["environmental_estimate"] is None for item in recommendations.values())
    assert recommendations["rec-006"]["guidance_summary"]
    assert recommendations["rec-006"]["implementation_steps"]
    assert recommendations["rec-006"]["guidance_limitations"]
    assert recommendations["rec-006"]["source_references"]


def test_individual_workspace_action_lifecycle_is_persisted(db_session):
    workspace = create_workspace(
        WorkspaceCreate(name="Action Plan Home", type="individual"),
        db_session,
    )
    action = create_action(ActionCreate(
        workspace_id=workspace["id"],
        recommendation_id="rec-002",
        title="Measure standby power",
        category="home-energy",
        status="planned",
        planned_date="2026-10-17",
    ), db_session)
    assert list_actions(workspace["id"], None, db_session)["items"][0]["id"] == action["id"]
    assert get_action(action["id"], db_session)["title"] == "Measure standby power"

    in_progress = update_action(
        action["id"],
        ActionUpdate(status="in-progress"),
        db_session,
    )
    assert in_progress["status"] == "in-progress"
    ledger = list_impact_entries(workspace["id"], None, db_session)
    assert ledger["items"][0]["data_source"] == "not-reported"
    assert ledger["items"][0]["actual_value"] is None

    updated = update_action(
        action["id"],
        ActionUpdate(
            status="completed",
            completed_date="2026-10-17",
            actual_expenditure_amount=240,
            actual_savings_amount=200,
            notes="User reported from the latest bill.",
        ),
        db_session,
    )
    assert updated["status"] == "completed"
    assert updated["actual_expenditure_amount"] == 240
    assert updated["actual_savings_amount"] == 200
    assert updated["notes"] == "User reported from the latest bill."
    persisted = get_action(action["id"], db_session)
    assert persisted["actual_expenditure_amount"] == 240
    assert persisted["actual_savings_amount"] == 200
    assert persisted["notes"] == "User reported from the latest bill."
    ledger = list_impact_entries(workspace["id"], None, db_session)
    assert ledger["total"] == 1
    assert ledger["items"][0]["title"] == "Measure standby power"
    assert ledger["items"][0]["actual_value"] == 200
    assert ledger["items"][0]["data_source"] == "user-reported"
    assert delete_action(action["id"], db_session) is None
    assert list_actions(workspace["id"], None, db_session)["total"] == 0


@pytest.mark.parametrize("field", ["actual_expenditure_amount", "actual_savings_amount"])
@pytest.mark.parametrize("value", [-0.01, float("inf"), float("nan")])
def test_action_results_reject_negative_or_non_finite_amounts(field, value):
    with pytest.raises(ValidationError):
        ActionUpdate(**{field: value})


def test_demo_workspace_records_are_inaccessible_through_live_apis(db_session):
    db_session.add(Workspace(
        id="ws-demo",
        name="Demo",
        type="individual",
        is_demo=True,
    ))
    db_session.add(Action(
        id="act-demo",
        workspace_id="ws-demo",
        title="Demo action",
        category="energy",
        planned_date="2026-01-01",
    ))
    db_session.add(SavedComparison(
        id="cmp-demo",
        workspace_id="ws-demo",
        scenario="lighting",
        title="Demo comparison",
        inputs_json="{}",
        result_json="{}",
    ))
    db_session.add(EcoAssessment(
        id="eco-demo",
        workspace_id="ws-demo",
        image_filename="demo.jpg",
        model_id="test",
        model_version="1",
        processing_time_ms=1,
    ))
    db_session.add(VisualObservation(
        id="obs-demo",
        assessment_id="eco-demo",
        class_label="bottle",
        sustainability_category="unmapped",
        confidence=0.9,
        bbox_x=0,
        bbox_y=0,
        bbox_w=1,
        bbox_h=1,
    ))
    db_session.commit()

    request = Request({
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/eco-scorer/analyse",
        "raw_path": b"/api/eco-scorer/analyse",
        "query_string": b"",
        "headers": [],
        "client": ("test", 1),
        "server": ("test", 80),
    })
    rejected_calls = [
        lambda: list_actions("ws-demo", None, db_session),
        lambda: create_action(ActionCreate(
            workspace_id="ws-demo",
            title="New action",
            category="energy",
            planned_date="2026-01-01",
        ), db_session),
        lambda: get_action("act-demo", db_session),
        lambda: update_action("act-demo", ActionUpdate(status="completed"), db_session),
        lambda: delete_action("act-demo", db_session),
        lambda: list_impact_entries("ws-demo", None, db_session),
        lambda: export_csv("ws-demo", "actions", db_session),
        lambda: generate_pdf("ws-demo", "", "", db_session),
        lambda: generate_report_alias("ws-demo", db_session),
        lambda: list_comparisons("ws-demo", db_session),
        lambda: calculate_comparison(ComparisonInput(
            scenario="lighting",
            inputs={"num_bulbs": 1, "hours_per_day": 1, "price_per_kwh": 1},
            workspace_id="ws-demo",
            save=True,
        ), db_session),
        lambda: list_assessments("ws-demo", db_session),
        lambda: asyncio.run(analyse_image(request, "ws-demo", db_session)),
        lambda: update_observation("obs-demo", ObservationUpdate(status="confirmed"), db_session),
        lambda: save_to_planner("eco-demo", db_session),
        lambda: delete_assessment("eco-demo", db_session),
    ]

    for call in rejected_calls:
        with pytest.raises(HTTPException) as error:
            call()
        assert error.value.status_code == 404

    assert db_session.get(Action, "act-demo") is not None
    assert db_session.get(EcoAssessment, "eco-demo") is not None
    assert db_session.get(VisualObservation, "obs-demo").status == "detected"
    assert db_session.get(SavedComparison, "cmp-demo") is not None
