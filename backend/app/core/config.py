"""
EcoTwin AI — Application Configuration
Reads settings from environment variables with safe defaults.
"""

import os
from pathlib import Path
from typing import List

# Project root = ecotwin-ai/ (parent of backend/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_DEFAULT_DB = _PROJECT_ROOT / "data" / "ecotwin.db"


class Settings:
    project_root: Path = _PROJECT_ROOT
    app_name: str = "EcoTwin AI"
    version: str = "1.1.0"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    default_currency: str = os.getenv("DEFAULT_CURRENCY", "INR")
    default_locale: str = os.getenv("DEFAULT_LOCALE", "en-IN")
    default_city: str = os.getenv("DEFAULT_CITY", "Hyderabad")
    default_state: str = os.getenv("DEFAULT_STATE", "Telangana")

    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{_DEFAULT_DB.as_posix()}",
    )

    cors_origins: List[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    ]

    secret_key: str = os.getenv("SECRET_KEY", "CHANGE-THIS-IN-PRODUCTION")
    api_token: str = os.getenv("API_TOKEN", "")
    require_workspace_id: bool = os.getenv("REQUIRE_WORKSPACE_ID", "true").lower() == "true"

    cv_model_path: str = os.getenv(
        "CV_MODEL_PATH",
        str(_PROJECT_ROOT / "computer_vision" / "models" / "yolox_tiny.onnx"),
    )
    cv_confidence_threshold: float = float(os.getenv("CV_CONFIDENCE_THRESHOLD", "0.35"))
    cv_max_image_size_mb: int = int(os.getenv("CV_MAX_IMAGE_SIZE_MB", "10"))
    cv_temp_image_dir: str = os.getenv(
        "CV_TEMP_IMAGE_DIR",
        str(_PROJECT_ROOT / "data" / "temporary_images"),
    )
    supported_image_types: List[str] = ["image/jpeg", "image/png", "image/webp"]
    max_image_dimension: int = int(os.getenv("MAX_IMAGE_DIMENSION", "1920"))


settings = Settings()

# Ensure data directory exists
os.makedirs(os.path.dirname(_DEFAULT_DB), exist_ok=True)
