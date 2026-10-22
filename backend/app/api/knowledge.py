"""
EcoPath.AI — Knowledge Base API Routes
"""
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.knowledge_article import KnowledgeArticle
from app.services.knowledge_import import upsert_articles

router = APIRouter()


class ArticleResponse(BaseModel):
    id: str
    title: str
    category: str
    summary: str
    content: str
    audience: List[str]
    implementation_steps: List[str]
    limitations: List[str]
    source_title: str
    source_publisher: str
    source_url: str
    publication_date: str
    verification_status: str
    tags: List[str]

    model_config = {"from_attributes": True}


def _parse_json_field(value: Optional[str]) -> List[str]:
    """Safely parse a JSON-encoded list stored as a string."""
    if not value:
        return []
    try:
        result = json.loads(value)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _article_to_response(article: KnowledgeArticle) -> dict:
    return {
        "id": article.id,
        "title": article.title,
        "category": article.category or "",
        "summary": article.summary or "",
        "content": article.content or "",
        "audience": _parse_json_field(article.audience),
        "implementation_steps": _parse_json_field(article.implementation_steps),
        "limitations": _parse_json_field(article.limitations),
        "source_title": article.source_title or "",
        "source_publisher": article.source_publisher or "",
        "source_url": article.source_url or "",
        "publication_date": article.publication_date or "",
        "verification_status": article.verification_status or "unverified",
        "tags": _parse_json_field(article.tags),
    }


@router.post("/import")
def import_from_files(db: Session = Depends(get_db)):
    count = upsert_articles(db)
    return {"imported": count}


@router.get("/")
def list_articles(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    audience: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search and filter knowledge base articles."""
    query = db.query(KnowledgeArticle).filter(KnowledgeArticle.is_active == True)

    if search:
        term = f"%{search}%"
        query = query.filter(
            KnowledgeArticle.title.ilike(term)
            | KnowledgeArticle.summary.ilike(term)
            | KnowledgeArticle.tags.ilike(term)
        )
    if category:
        query = query.filter(KnowledgeArticle.category == category)
    if audience:
        query = query.filter(KnowledgeArticle.audience.ilike(f'%"{audience}"%'))

    total = query.count()
    articles = query.order_by(KnowledgeArticle.title).offset((page - 1) * size).limit(size).all()

    return {
        "items": [_article_to_response(a) for a in articles],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/{article_id}")
def get_article(article_id: str, db: Session = Depends(get_db)):
    """Get a single knowledge base article by ID."""
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return _article_to_response(article)
