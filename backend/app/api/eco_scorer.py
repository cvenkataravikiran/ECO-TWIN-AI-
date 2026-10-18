"""
Eco-Scorer API — local ONNX inference only.
Never returns mock detections. If the model cannot run, respond 503.
"""
from __future__ import annotations

import json
import sys
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.measured_resources import latest_measured_monthly_electricity
from app.core.workspace_access import require_live_workspace
from app.db.database import get_db
from app.models.action_plan import Action
from app.models.eco_assessment import EcoAssessment, VisualObservation
from app.models.knowledge_article import KnowledgeArticle
from app.models.workspace import Workspace

_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

router = APIRouter()


def _rules_and_score():
    from computer_vision.scoring.eco_score import load_rules, map_class, score_observations

    rules = load_rules(settings.project_root)
    return rules, map_class, score_observations


def _article_ids_for_mapping(mapped: dict[str, Any]) -> set[str]:
    ids: set[str] = set()
    primary_id = mapped.get("knowledge_article_id")
    if isinstance(primary_id, str) and primary_id:
        ids.add(primary_id)
    additional_ids = mapped.get("additional_knowledge_article_ids", [])
    if isinstance(additional_ids, list):
        ids.update(article_id for article_id in additional_ids if isinstance(article_id, str) and article_id)
    return ids


@lru_cache(maxsize=1)
def _get_detector():
    from computer_vision.detection.onnx_detector import OnnxDetector

    return OnnxDetector(settings.cv_model_path, confidence=settings.cv_confidence_threshold)


class ObservationUpdate(BaseModel):
    status: Literal["detected", "confirmed", "corrected", "dismissed"]
    user_label: Optional[str] = Field(default=None, max_length=100)
    user_notes: Optional[str] = Field(default=None, max_length=1000)


def _knowledge_recommendations(
    db: Session,
    workspace_id: str,
    observations: list[VisualObservation],
    rules: dict[str, Any],
    map_class: Callable[[str, dict[str, Any]], dict[str, Any]],
) -> list[dict]:
    article_observations: dict[str, list[VisualObservation]] = {}
    has_standby_energy_guidance = False
    for obs in observations:
        if obs.status not in {"confirmed", "corrected"}:
            continue
        mapped = map_class(obs.class_label, rules)
        mapped_article_ids = _article_ids_for_mapping(mapped)
        if "kb-002" in mapped_article_ids:
            has_standby_energy_guidance = True
        for article_id in mapped_article_ids:
            article_observations.setdefault(article_id, []).append(obs)
    if not article_observations:
        return []

    articles = (
        db.query(KnowledgeArticle)
        .filter(
            KnowledgeArticle.is_active.is_(True),
            KnowledgeArticle.id.in_(article_observations),
        )
        .all()
    )
    unavailable_article_ids = set(article_observations) - {article.id for article in articles}
    if unavailable_article_ids:
        raise HTTPException(
            status_code=503,
            detail="Mapped knowledge-base recommendations are unavailable. Import the EcoTwin knowledge-base articles and retry.",
        )
    results = []
    electricity_context = (
        latest_measured_monthly_electricity(db, workspace_id)
        if has_standby_energy_guidance
        else None
    )
    engine_recommendation = None
    if electricity_context:
        from app.recommendation_engine.engine import UserContext, generate_recommendations

        workspace = db.get(Workspace, workspace_id)
        if workspace:
            engine_results = generate_recommendations(UserContext(
                workspace_type=workspace.type,
                monthly_electricity_kwh=electricity_context["kwh"],
                monthly_electricity_cost=electricity_context["cost"],
                price_per_kwh=electricity_context["price_per_kwh"],
                currency=electricity_context["currency"],
            ))
            result = next((item for item in engine_results if item.id == "rec-002"), None)
            if result:
                engine_recommendation = {
                    "id": result.id,
                    "title": result.title,
                    "relevance_explanation": result.relevance_explanation,
                    "formula_description": result.formula_description,
                    "assumptions": result.assumptions,
                    "missing_data": result.missing_data,
                    "estimated_monthly_savings": result.estimated_monthly_savings,
                    "currency": result.estimated_monthly_savings_currency,
                    "confidence_level": result.confidence_level,
                    "measurement_period": electricity_context["period"],
                    "data_basis": "Measured workspace electricity record; independent of the photo.",
                    "baseline_monthly_electricity_kwh": electricity_context["kwh"],
                    "baseline_monthly_electricity_cost": electricity_context["cost"],
                    "baseline_currency": electricity_context["currency"],
                }
    for article in sorted(articles, key=lambda item: item.title.casefold()):
        related = article_observations[article.id]
        recommendation = {
            "id": article.id,
            "article_id": article.id,
            "title": article.title,
            "category": article.category,
            "summary": article.summary,
            "implementation_steps": json.loads(article.implementation_steps or "[]"),
            "limitations": json.loads(article.limitations or "[]"),
            "observation_ids": [obs.id for obs in related],
            "guidance": sorted({
                map_class(obs.class_label, rules).get("guidance", "")
                for obs in related
                if map_class(obs.class_label, rules).get("guidance")
            }),
        }
        if article.id == "kb-002" and engine_recommendation:
            recommendation["deterministic_recommendation"] = engine_recommendation
        results.append(recommendation)
    return results


def _obs_dict(obs: VisualObservation, guidance: str = "") -> dict:
    return {
        "id": obs.id,
        "class_label": obs.class_label,
        "classLabel": obs.class_label,
        "sustainability_category": obs.sustainability_category,
        "sustainabilityCategory": obs.sustainability_category,
        "confidence": obs.confidence,
        "bbox": {"x": obs.bbox_x, "y": obs.bbox_y, "w": obs.bbox_w, "h": obs.bbox_h},
        "status": obs.status,
        "user_label": obs.user_label,
        "userLabel": obs.user_label,
        "guidance": guidance,
    }


def _runtime_status(db: Session) -> dict:
    model_path = Path(settings.cv_model_path)
    dependencies = {}
    for package, module in {
        "onnxruntime": "onnxruntime",
        "Pillow": "PIL",
        "numpy": "numpy",
    }.items():
        try:
            __import__(module)
            dependencies[package] = True
        except (ImportError, OSError):
            dependencies[package] = False
    rules, _, _ = _rules_and_score()
    mapped_article_ids = set()
    for entry in rules.get("class_map", {}).values():
        if entry.get("knowledge_article_id"):
            mapped_article_ids.add(entry["knowledge_article_id"])
        mapped_article_ids.update(entry.get("additional_knowledge_article_ids", []))
    loaded_article_ids = {
        row[0]
        for row in db.query(KnowledgeArticle.id).filter(
            KnowledgeArticle.is_active.is_(True),
            KnowledgeArticle.id.in_(mapped_article_ids),
        ).all()
    }
    knowledge_base_ready = mapped_article_ids.issubset(loaded_article_ids)
    dependencies["knowledge_base"] = knowledge_base_ready
    model_loadable = False
    if model_path.is_file() and knowledge_base_ready and all(
        ready for name, ready in dependencies.items() if name != "knowledge_base"
    ):
        from computer_vision.detection.onnx_detector import ModelNotAvailable

        try:
            _get_detector()._session_ort()
            model_loadable = True
        except ModelNotAvailable:
            model_loadable = False
    operational = model_path.is_file() and all(dependencies.values()) and model_loadable
    setup = [
        "From the backend folder, install dependencies with: pip install -r requirements.txt",
        "From the project root, fetch the licensed local weights with: python scripts/download_cv_model.py",
        "Restart the backend after installing the model.",
    ]
    if not knowledge_base_ready:
        setup.append("Ensure the mapped knowledge-base articles are imported into the database.")
    return {
        "operational": operational,
        "model_present": model_path.is_file(),
        "model_loadable": model_loadable,
        "dependencies": dependencies,
        "licence": "Apache 2.0 — Megvii-BaseDetection/YOLOX",
        "setup": setup,
        "limitations": [
            "COCO classes identify object shapes, not materials, recyclability, BEE star ratings, or energy use.",
            "A photo cannot establish lifecycle emissions or actual electricity consumption.",
            "Images are processed in memory and are not stored.",
        ],
    }


@router.get("/status")
def scorer_status(db: Session = Depends(get_db)):
    return _runtime_status(db)


@router.post("/analyse")
async def analyse_image(
    request: Request,
    workspace_id: str = Query(...),
    db: Session = Depends(get_db),
):
    require_live_workspace(db, workspace_id)
    if not _runtime_status(db)["operational"]:
        raise HTTPException(
            status_code=503,
            detail=(
                "Eco-Scorer is unavailable because its local model or inference dependencies "
                "are missing. Install backend requirements, download the licensed model with "
                "scripts/download_cv_model.py, then restart the backend. No simulated detections are returned."
            ),
        )
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in settings.supported_image_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {content_type or 'missing'}. Use JPEG, PNG, or WebP.",
        )

    from computer_vision.image_validation import InvalidImage, validate_image

    max_bytes = settings.cv_max_image_size_mb * 1024 * 1024
    contents = bytearray()
    async for chunk in request.stream():
        if len(contents) + len(chunk) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Image exceeds the {settings.cv_max_image_size_mb} MB upload limit.",
            )
        contents.extend(chunk)
    try:
        image = validate_image(
            bytes(contents),
            content_type,
            max_bytes,
            settings.max_image_dimension,
        )
    except InvalidImage as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    from computer_vision.detection.onnx_detector import InferenceError, ModelNotAvailable

    detector = _get_detector()
    start = time.time()
    try:
        detections = detector.detect_image(image)
    except ModelNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Eco-Scorer is unavailable because its local model or inference dependencies "
                "could not be loaded. Install backend requirements, download the licensed model "
                "with scripts/download_cv_model.py, then restart the backend. No simulated "
                "detections are returned."
            ),
        ) from exc
    except InferenceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    processing_time_ms = int((time.time() - start) * 1000)
    rules, map_class, score_observations = _rules_and_score()

    assessment = EcoAssessment(
        id=f"eco-{uuid.uuid4().hex[:8]}",
        workspace_id=workspace_id,
        image_filename="uploaded image",
        model_id="yolox-tiny",
        model_version="0.1.1",
        processing_time_ms=processing_time_ms,
        score_value=None,
        score_max=None,
        evidence_coverage=0.0,
        is_reliable=False,
        image_retained=False,
    )
    db.add(assessment)

    payload_dets = []
    for det in detections:
        mapped = map_class(det.class_label, rules)
        obs = VisualObservation(
            id=f"obs-{uuid.uuid4().hex[:8]}",
            assessment_id=assessment.id,
            class_label=det.class_label,
            sustainability_category=mapped.get("category", "Unmapped / needs confirmation"),
            confidence=det.confidence,
            bbox_x=det.bbox["x"],
            bbox_y=det.bbox["y"],
            bbox_w=det.bbox["w"],
            bbox_h=det.bbox["h"],
            status="detected",
        )
        db.add(obs)
        payload_dets.append(
            {
                "id": obs.id,
                "class_label": det.class_label,
                "classLabel": det.class_label,
                "confidence": det.confidence,
                "sustainability_category": obs.sustainability_category,
                "sustainabilityCategory": obs.sustainability_category,
                "bbox": det.bbox,
                "status": "detected",
                "guidance": mapped.get("guidance", ""),
            }
        )

    score_result = score_observations(
        [{"status": "detected", "sustainability_category": d["sustainability_category"]} for d in payload_dets],
        rules,
    )
    assessment.score_value = score_result.get("score")
    assessment.evidence_coverage = score_result.get("review_coverage")
    assessment.is_reliable = bool(score_result.get("is_reliable"))
    db.commit()

    return {
        "assessment_id": assessment.id,
        "is_demo": False,
        "model": {
            "id": assessment.model_id,
            "version": assessment.model_version,
            "licence": "Apache 2.0",
        },
        "processing_time_ms": processing_time_ms,
        "detections": payload_dets,
        "eco_score": score_result,
        "recommendations": [],
        "privacy_notice": "The image was processed in memory and was not stored.",
    }


@router.patch("/observations/{observation_id}")
def update_observation(observation_id: str, payload: ObservationUpdate, db: Session = Depends(get_db)):
    if payload.status == "corrected" and not (payload.user_label or "").strip():
        raise HTTPException(status_code=400, detail="A corrected observation requires a replacement label.")
    obs = db.get(VisualObservation, observation_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    assessment = db.get(EcoAssessment, obs.assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    require_live_workspace(db, str(assessment.workspace_id))
    obs.status = payload.status
    if payload.user_label is not None:
        obs.user_label = payload.user_label.strip()
        if payload.status == "corrected":
            obs.class_label = payload.user_label.strip()
    if payload.user_notes is not None:
        obs.user_notes = payload.user_notes

    rules, map_class, score_observations = _rules_and_score()
    mapped = map_class(obs.class_label, rules)
    obs.sustainability_category = mapped.get("category", "Unmapped / needs confirmation")
    all_obs = (
        db.query(VisualObservation).filter(VisualObservation.assessment_id == obs.assessment_id).all()
    )
    score_result = score_observations(
        [
            {
                "status": o.status,
                "sustainability_category": o.sustainability_category,
            }
            for o in all_obs
        ],
        rules,
    )
    assessment.score_value = score_result.get("score")
    assessment.score_max = score_result.get("max_score")
    assessment.evidence_coverage = score_result.get("review_coverage")
    assessment.is_reliable = bool(score_result.get("is_reliable"))
    db.commit()

    return {
        "observation": _obs_dict(obs, mapped.get("guidance", "")),
        "eco_score": score_result,
        "recommendations": _knowledge_recommendations(
            db, str(assessment.workspace_id), all_obs, rules, map_class
        ),
    }


@router.post("/assessments/{assessment_id}/save-actions")
def save_to_planner(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.get(EcoAssessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    require_live_workspace(db, str(assessment.workspace_id))
    confirmed = (
        db.query(VisualObservation)
        .filter(
            VisualObservation.assessment_id == assessment_id,
            VisualObservation.status.in_(["confirmed", "corrected"]),
        )
        .all()
    )
    rules, map_class, _ = _rules_and_score()
    recommendations = _knowledge_recommendations(
        db, str(assessment.workspace_id), confirmed, rules, map_class
    )
    recommendation_by_article = {item["article_id"]: item for item in recommendations}
    created = []
    for article_id, recommendation in recommendation_by_article.items():
        recommendation_id = f"eco-{assessment.id}-{article_id}"
        if db.query(Action).filter(Action.recommendation_id == recommendation_id).first():
            continue
        notes = (
            "Suggested from confirmed visual observations. Review the linked Knowledge Base "
            "article and user-confirmed guidance before acting. No environmental impact was inferred "
            "from the image.\n"
            + "\n".join(recommendation["guidance"])
        )
        calculation = recommendation.get("deterministic_recommendation")
        if calculation:
            notes += (
                "\n\nWorkspace data (independent of the photo): "
                f"{calculation['measurement_period']} measured electricity use was "
                f"{calculation['baseline_monthly_electricity_kwh']:.2f} kWh at "
                f"{calculation['baseline_currency']} "
                f"{calculation['baseline_monthly_electricity_cost']:.2f}."
            )
            savings = calculation["estimated_monthly_savings"]
            if savings is not None:
                notes += (
                    f"\nEstimated monthly cost savings: {calculation['currency']} "
                    f"{savings:.2f} (confidence: {calculation['confidence_level']})."
                )
            notes += f"\nFormula: {calculation['formula_description']}"
            notes += "\nAssumptions: " + "; ".join(calculation["assumptions"])
            notes += "\nMissing data: " + "; ".join(calculation["missing_data"])
        action = Action(
            id=f"act-{uuid.uuid4().hex[:8]}",
            workspace_id=assessment.workspace_id,
            recommendation_id=recommendation_id,
            title=f"Review: {recommendation['title']}"[:255],
            category=recommendation["category"],
            status="suggested",
            planned_date=time.strftime("%Y-%m-%d"),
            initial_estimate_amount=None,
            initial_estimate_currency="INR",
            notes=notes[:4000],
        )
        db.add(action)
        created.append(action.id)
    db.commit()
    return {
        "created_action_ids": created,
        "count": len(created),
        "recommendations": recommendations,
    }


@router.get("/assessments")
def list_assessments(
    workspace_id: str = Query(...),
    db: Session = Depends(get_db),
):
    require_live_workspace(db, workspace_id)
    assessments = (
        db.query(EcoAssessment)
        .filter(EcoAssessment.workspace_id == workspace_id)
        .order_by(EcoAssessment.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "image_filename": a.image_filename,
                "model_id": a.model_id,
                "score_value": a.score_value,
                "score_max": a.score_max,
                "review_coverage": a.evidence_coverage,
                "is_reliable": a.is_reliable,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in assessments
        ],
        "total": len(assessments),
    }


@router.delete("/assessments/{assessment_id}", status_code=204)
def delete_assessment(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.get(EcoAssessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    require_live_workspace(db, str(assessment.workspace_id))
    db.delete(assessment)
    db.commit()
    return None
