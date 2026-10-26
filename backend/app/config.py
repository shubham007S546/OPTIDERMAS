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
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    ELEVEN_API_KEY: str = ""
    ELEVENLABS_AGENT_ID: str = ""

    # Vision settings
    VISION_MODEL_PROVIDER: str = "groq"
    EFFICIENTNET_WEIGHTS_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "model",
        "optiderma_best_model.pth",
    )

    # Persistence settings ("auto" | "sqlite" | "supabase")
    PERSISTENCE_BACKEND: str = os.getenv("PERSISTENCE_BACKEND", "auto")
    SUPABASE_URL: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://uwlatkypjzfnobrobzns.supabase.co")
    SUPABASE_KEY: str = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_wXqtTFvTROzE0h0bqQfAag_Z-l2Ci-x")
    )

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", ".env.local", "../.env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
