import asyncio
import io
import json
from pathlib import Path

import httpx
import numpy as np
import pytest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from fastapi import FastAPI
from app.api.eco_scorer import (
    ObservationUpdate,
    save_to_planner,
    update_observation,
)
from app.models.action_plan import Action
from app.models.eco_assessment import EcoAssessment, VisualObservation
from app.models.knowledge_article import KnowledgeArticle
from app.models.resource_record import ResourceRecord
from app.models.workspace import Workspace
from app.db.database import Base, get_db
from computer_vision.detection.onnx_detector import InferenceError, OnnxDetector, _nms
from computer_vision.image_validation import InvalidImage, validate_image
from computer_vision.scoring.eco_score import load_rules, map_class, score_observations


def image_bytes(image_format: str = "PNG") -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (64, 32), color=(20, 80, 40)).save(output, format=image_format)
    return output.getvalue()


def test_validate_image_checks_format_and_resizes():
    image = validate_image(image_bytes(), "image/png", 1024, 32)
    assert image.size == (32, 16)
    assert image.mode == "RGB"

    with pytest.raises(InvalidImage, match="do not match"):
        validate_image(image_bytes(), "image/jpeg", 1024, 1920)


def test_validate_image_rejects_empty_oversized_and_malformed_files():
    with pytest.raises(InvalidImage, match="empty"):
        validate_image(b"", "image/png", 1024, 1920)
    with pytest.raises(InvalidImage, match="upload limit"):
        validate_image(image_bytes(), "image/png", 10, 1920)
    with pytest.raises(InvalidImage, match="valid supported"):
        validate_image(b"not an image", "image/png", 1024, 1920)


def test_detector_runs_postprocessing_on_model_output():
    class FakeSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "images"})()]

        def run(self, _outputs, _inputs):
            raw = np.zeros((1, 3549, 85), dtype=np.float32)
            index = 13 * 52 + 26
            raw[0, index, 4] = 0.9
            raw[0, index, 5] = 0.95
            raw[0, index, 2:4] = 3.0
            return [raw]

    detector = OnnxDetector("unused.onnx", confidence=0.35)
    detector._session = FakeSession()
    detections = detector.detect_image(Image.new("RGB", (64, 32)))
    assert len(detections) == 1
    assert detections[0].class_label == "person"
    assert detections[0].confidence == pytest.approx(0.855, abs=0.001)
    assert detections[0].bbox["w"] > 0
    assert detections[0].bbox["h"] > 0


def test_detector_rejects_unexpected_model_output():
    class FakeSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "images"})()]

        def run(self, _outputs, _inputs):
            return [np.zeros((1, 10, 20), dtype=np.float32)]

    detector = OnnxDetector("unused.onnx")
    detector._session = FakeSession()
    with pytest.raises(InferenceError, match="Unexpected model output"):
        detector.detect_image(Image.new("RGB", (64, 32)))


def test_detector_nms_suppresses_duplicates_only_within_same_class():
    boxes = np.array([[0, 0, 10, 10], [0, 0, 10, 10]], dtype=np.float32)
    scores = np.array([0.9, 0.8], dtype=np.float32)
    assert _nms(boxes, scores, class_ids=np.array([1, 2])) == [0, 1]
    assert _nms(boxes, scores, class_ids=np.array([1, 1])) == [0]


def test_assessment_never_scores_environmental_impact_from_detected_objects():
    rules = load_rules(Path(__file__).resolve().parents[2])
    result = score_observations(
        [
            {"status": "detected", "sustainability_category": "Transport"},
            {"status": "confirmed", "sustainability_category": "Transport"},
            {"status": "dismissed", "sustainability_category": "Electronics"},
        ],
        rules,
    )
    assert result["score"] is None
    assert result["max_score"] is None
    assert result["is_reliable"] is False
    assert result["review_coverage"] == 0.67
    assert result["confirmed_observation_count"] == 1
    assert result["contributions"] == [{"category": "Transport"}]


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def scorer_client(db_session, monkeypatch):
    from app.api import eco_scorer as scorer_api

    db_session.add(Workspace(id="ws-upload", name="Upload Test", type="individual"))
    db_session.commit()
    app = FastAPI()
    app.include_router(scorer_api.router, prefix="/api/eco-scorer")

    def override_db():
        yield db_session

    class EmptyDetector:
        def detect_image(self, _image):
            return []

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(scorer_api, "_runtime_status", lambda _db: {"operational": True})
    monkeypatch.setattr(scorer_api, "_get_detector", lambda: EmptyDetector())

    def post(path: str, **kwargs):
        async def send():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.post(path, **kwargs)

        return asyncio.run(send())

    yield post


def test_analysis_api_validates_image_and_returns_real_empty_result(scorer_client):
    response = scorer_client(
        "/api/eco-scorer/analyse?workspace_id=ws-upload",
        content=image_bytes(),
        headers={"Content-Type": "image/png"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["is_demo"] is False
    assert payload["detections"] == []
    assert payload["eco_score"]["score"] is None
    assert "not stored" in payload["privacy_notice"]

    invalid = scorer_client(
        "/api/eco-scorer/analyse?workspace_id=ws-upload",
        content=b"not an image",
        headers={"Content-Type": "image/png"},
    )
    assert invalid.status_code == 400


def test_analysis_api_rejects_oversized_stream(scorer_client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "cv_max_image_size_mb", 1)
    response = scorer_client(
        "/api/eco-scorer/analyse?workspace_id=ws-upload",
        content=b"x" * (1024 * 1024 + 1),
        headers={"Content-Type": "image/png"},
    )
    assert response.status_code == 413


def seed_article_and_observation(db: Session):
    db.add(Workspace(id="ws-test", name="Test", type="individual"))
    db.add(KnowledgeArticle(
        id="kb-007",
        title="Waste hierarchy and segregation",
        category="waste-circular",
        summary="Reuse and follow local waste rules.",
        content="Article content",
        audience=json.dumps(["individual"]),
        applicability_conditions="[]",
        implementation_steps=json.dumps(["Confirm local rules"]),
        limitations=json.dumps(["Local rules vary"]),
        source_title="CPCB",
        source_publisher="CPCB",
        source_url="",
        publication_date="",
        last_verified_date="",
        verification_status="verified",
        tags=json.dumps(["waste"]),
        is_active=True,
    ))
    db.add(EcoAssessment(
        id="eco-test",
        workspace_id="ws-test",
        image_filename="uploaded image",
        model_id="yolox-tiny",
        model_version="0.1.1",
        processing_time_ms=1,
        score_value=None,
        score_max=None,
        evidence_coverage=0,
        is_reliable=False,
        image_retained=False,
    ))
    observation = VisualObservation(
        id="obs-test",
        assessment_id="eco-test",
        class_label="bottle",
        sustainability_category="Reusable vs disposable",
        confidence=0.9,
        bbox_x=1,
        bbox_y=1,
        bbox_w=10,
        bbox_h=10,
        status="detected",
    )
    db.add(observation)
    db.commit()
    return observation


def seed_energy_assessment(db: Session):
    db.add(Workspace(id="ws-energy", name="Energy Test", type="individual"))
    for article_id, title, category in (
        ("kb-002", "Standby power", "home-energy"),
        ("kb-005", "Repair and reuse", "shopping-products"),
    ):
        db.add(KnowledgeArticle(
            id=article_id,
            title=title,
            category=category,
            summary="Guidance for testing.",
            content="Article content",
            audience=json.dumps(["individual"]),
            applicability_conditions="[]",
            implementation_steps=json.dumps(["Review measured use"]),
            limitations=json.dumps(["Use device-level measurements for precision"]),
            source_title="EcoTwin",
            source_publisher="EcoTwin",
            source_url="",
            publication_date="",
            last_verified_date="",
            verification_status="verified",
            tags=json.dumps(["energy"]),
            is_active=True,
        ))
    db.add(EcoAssessment(
        id="eco-energy",
        workspace_id="ws-energy",
        image_filename="uploaded image",
        model_id="yolox-tiny",
        model_version="0.1.1",
        processing_time_ms=1,
        score_value=None,
        score_max=None,
        evidence_coverage=0,
        is_reliable=False,
        image_retained=False,
    ))
    observation = VisualObservation(
        id="obs-laptop",
        assessment_id="eco-energy",
        class_label="laptop",
        sustainability_category="Electronics and energy",
        confidence=0.9,
        bbox_x=1,
        bbox_y=1,
        bbox_w=10,
        bbox_h=10,
        status="detected",
    )
    db.add(observation)
    db.commit()
    return observation


def add_electricity_record(
    db: Session,
    *,
    record_id: str,
    measurement_type: str = "measured",
    unit: str = "kWh",
    period_start: str = "2025-02-01",
    period_end: str = "2025-02-28",
):
    db.add(ResourceRecord(
        id=record_id,
        workspace_id="ws-energy",
        category="electricity",
        description="Monthly electricity",
        quantity=320,
        unit=unit,
        cost=2560,
        currency="INR",
        period_start=period_start,
        period_end=period_end,
        measurement_type=measurement_type,
    ))


def test_confirmed_detection_retrieves_private_kb_and_saves_planner_action(db_session, monkeypatch):
    observation = seed_article_and_observation(db_session)
    rules = load_rules(Path(__file__).resolve().parents[2])
    monkeypatch.setattr(
        "app.api.eco_scorer._rules_and_score",
        lambda: (rules, map_class, score_observations),
    )

    updated = update_observation(
        observation.id,
        ObservationUpdate(status="confirmed"),
        db_session,
    )
    assert updated["eco_score"]["score"] is None
    assert updated["recommendations"][0]["article_id"] == "kb-007"
    assert updated["recommendations"][0]["implementation_steps"] == ["Confirm local rules"]

    saved = save_to_planner("eco-test", db_session)
    assert saved["count"] == 1
    action = db_session.query(Action).one()
    assert action.workspace_id == "ws-test"
    assert action.category == "waste-circular"
    assert "No environmental impact was inferred" in action.notes
    assert save_to_planner("eco-test", db_session)["count"] == 0


def test_unknown_correction_does_not_produce_recommendations(db_session, monkeypatch):
    observation = seed_article_and_observation(db_session)
    rules = load_rules(Path(__file__).resolve().parents[2])
    monkeypatch.setattr(
        "app.api.eco_scorer._rules_and_score",
        lambda: (rules, map_class, score_observations),
    )

    result = update_observation(
        observation.id,
        ObservationUpdate(status="corrected", user_label="unmapped gadget"),
        db_session,
    )
    assert result["observation"]["sustainability_category"] == "Unmapped / needs confirmation"
    assert result["recommendations"] == []


def test_confirmed_electronics_use_measured_month_with_deterministic_engine_and_planner(
    db_session, monkeypatch
):
    observation = seed_energy_assessment(db_session)
    add_electricity_record(db_session, record_id="res-february")
    db_session.commit()
    rules = load_rules(Path(__file__).resolve().parents[2])
    monkeypatch.setattr(
        "app.api.eco_scorer._rules_and_score",
        lambda: (rules, map_class, score_observations),
    )

    result = update_observation(
        observation.id,
        ObservationUpdate(status="confirmed"),
        db_session,
    )
    by_article = {item["article_id"]: item for item in result["recommendations"]}
    calculation = by_article["kb-002"]["deterministic_recommendation"]
    assert calculation["id"] == "rec-002"
    assert calculation["measurement_period"] == "2025-02"
    assert calculation["baseline_monthly_electricity_kwh"] == 320
    assert calculation["baseline_monthly_electricity_cost"] == 2560
    assert calculation["estimated_monthly_savings"] is None
    assert calculation["confidence_level"] == "insufficient"
    assert "No energy, cost, or emissions estimate" in calculation["formula_description"]
    assert "independent of the photo" in calculation["data_basis"]

    saved = save_to_planner("eco-energy", db_session)
    assert saved["count"] == 2
    standby_action = (
        db_session.query(Action)
        .filter(Action.recommendation_id == "eco-eco-energy-kb-002")
        .one()
    )
    assert "Workspace data (independent of the photo)" in standby_action.notes
    assert "Formula:" in standby_action.notes
    assert "Assumptions:" in standby_action.notes


def test_estimated_or_partial_electricity_does_not_trigger_calculation(db_session, monkeypatch):
    observation = seed_energy_assessment(db_session)
    add_electricity_record(db_session, record_id="res-estimated", measurement_type="estimated")
    add_electricity_record(
        db_session,
        record_id="res-partial",
        period_start="2025-03-01",
        period_end="2025-03-15",
    )
    db_session.commit()
    rules = load_rules(Path(__file__).resolve().parents[2])
    monkeypatch.setattr(
        "app.api.eco_scorer._rules_and_score",
        lambda: (rules, map_class, score_observations),
    )

    result = update_observation(
        observation.id,
        ObservationUpdate(status="confirmed"),
        db_session,
    )
    by_article = {item["article_id"]: item for item in result["recommendations"]}
    assert "kb-002" in by_article
    assert "deterministic_recommendation" not in by_article["kb-002"]
