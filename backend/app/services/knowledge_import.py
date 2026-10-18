"""Import knowledge-base JSON files into the database."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.knowledge_article import KnowledgeArticle


def articles_dir() -> Path:
    return settings.project_root / "knowledge_base" / "articles"


def load_article_files() -> list[dict]:
    folder = articles_dir()
    if not folder.exists():
        return []
    items = []
    for path in sorted(folder.glob("*.json")):
        with path.open(encoding="utf-8") as f:
            items.append(json.load(f))
    return items


def upsert_articles(db: Session) -> int:
    count = 0
    for data in load_article_files():
        article_id = data["id"]
        fields = dict(
            title=data.get("title", ""),
            category=data.get("category", ""),
            summary=data.get("summary", ""),
            content=data.get("content", ""),
            audience=json.dumps(data.get("audience", [])),
            applicability_conditions=json.dumps(data.get("applicability_conditions", [])),
            implementation_steps=json.dumps(data.get("implementation_steps", [])),
            limitations=json.dumps(data.get("limitations", [])),
            source_title=data.get("source_title", ""),
            source_publisher=data.get("source_publisher", ""),
            source_url=data.get("source_url", ""),
            publication_date=data.get("publication_date", ""),
            last_verified_date=data.get("last_verified_date", ""),
            verification_status=data.get("verification_status", "unverified"),
            tags=json.dumps(data.get("tags", [])),
            is_active=True,
        )
        existing = db.get(KnowledgeArticle, article_id)
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
        else:
            db.add(KnowledgeArticle(id=article_id, **fields))
        count += 1
    db.commit()
    return count
