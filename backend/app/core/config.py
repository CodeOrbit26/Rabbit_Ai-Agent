"""Application configuration loaded from environment variables."""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from backend root
_backend_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_backend_dir / ".env")


class Settings(BaseSettings):
    # ── LLM ──────────────────────────────────────────────
    gemini_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "gemini"          # "gemini" | "openai"
    gemini_model: str = "gemini-2.0-flash"
    openai_model: str = "gpt-4o-mini"

    # ── Server ───────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:5180,http://localhost:3000"

    # ── Database ─────────────────────────────────────────
    sqlite_db_path: str = "data/aria.db"
    faiss_index_dir: str = "data/faiss_index"

    # ── Derived ──────────────────────────────────────────
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def db_full_path(self) -> Path:
        return _backend_dir / self.sqlite_db_path

    @property
    def faiss_full_path(self) -> Path:
        return _backend_dir / self.faiss_index_dir

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
