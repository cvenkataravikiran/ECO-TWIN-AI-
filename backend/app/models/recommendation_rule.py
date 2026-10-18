from app.db.database import Base
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid


class RecommendationRule(Base):
    __tablename__ = "recommendation_rules"

    id = Column(String(100), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    problem_description = Column(Text, nullable=False)
    knowledge_article_id = Column(String(100), nullable=True)
    difficulty = Column(String(20), default="medium", nullable=False)  # easy, medium, hard
    estimated_upfront_cost = Column(Float, nullable=True)
    estimated_monthly_savings = Column(Float, nullable=True)
    applicability_conditions = Column(Text, default="[]", nullable=False)  # JSON list of condition strings
    tags = Column(Text, default="[]", nullable=False)  # JSON list
    priority_base_score = Column(Integer, default=50, nullable=False)  # base score 0-100
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(String(20), default="1.0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<RecommendationRule id={self.id} title='{self.title[:30]}' diff='{self.difficulty}'>"
