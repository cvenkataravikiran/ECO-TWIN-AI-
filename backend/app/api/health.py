"""
EcoPath.AI — Health Check Endpoint
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok", "service": "EcoPath.AI API", "version": "1.0.0"}
