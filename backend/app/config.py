"""OptiDerma Central Configuration Module using Pydantic Settings."""

import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "OptiDerma Multimodal Dermatology Assistant"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
    ]

    # API Keys
    GROQ_API_KEY: str = ""
    ELEVEN_API_KEY: str = ""
    ELEVENLABS_AGENT_ID: str = ""

    # Vision settings
    VISION_MODEL_PROVIDER: str = "groq"
    EFFICIENTNET_WEIGHTS_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "model",
        "optiderma_best_model.pth",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
