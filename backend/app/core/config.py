import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    APP_NAME: str = "MediTrace"
    DEBUG: bool = True
    PORT: int = 8000

    SECRET_KEY: str = "meditrace_dev_secret_key_change_in_production_2026_xyz"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = "sqlite+aiosqlite:///./meditrace.db"

    STORAGE_TYPE: str = "local"
    STORAGE_DIR: str = str(BASE_DIR / "storage_data")

    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-004"

    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    NOTIFY_SMS_DLT_ENTITY_ID: str = "11014567890123"
    NOTIFY_WHATSAPP_TOKEN: str = ""

    # Emergency phone numbers (India)
    EMERGENCY_NUMBERS: dict[str, str] = {
        "national_emergency": "112",
        "ambulance": "108",
        "medical_helpline": "102",
        "women_helpline": "1091"
    }

    # Pilot languages supported
    SUPPORTED_LANGUAGES: list[str] = ["en", "hi", "bn", "ta"]

settings = Settings()
