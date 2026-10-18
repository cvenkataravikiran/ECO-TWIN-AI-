"""
EcoTwin AI — Knowledge Article SQLAlchemy Model
"""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from app.db.database import Base


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False)
    summary = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    audience = Column(Text, default="[]")  # JSON-serialized list
    applicability_conditions = Column(Text, default="[]")  # JSON-serialized list
    implementation_steps = Column(Text, default="[]")  # JSON-serialized list
    limitations = Column(Text, default="[]")  # JSON-serialized list
    source_title = Column(String(255), default="")
    source_publisher = Column(String(255), default="")
    source_url = Column(String(512), default="")
    publication_date = Column(String(32), default="")
    last_verified_date = Column(String(32), default="")
    verification_status = Column(String(32), default="unverified")
    tags = Column(Text, default="[]")  # JSON-serialized list
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
