from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Top-level application settings loaded from environment variables."""

    # Core infrastructure
    postgres_dsn: str = Field(..., alias="POSTGRES_DSN")
    rabbit_url: str = Field(..., alias="RABBIT_URL")

    # OpenAI
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4.1-mini", alias="OPENAI_MODEL")
    openai_timeout_seconds: int = 60

    # AWS / S3
    aws_access_key_id: str = Field(..., alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(..., alias="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(..., alias="AWS_REGION")
    s3_bucket: str = Field(..., alias="S3_BUCKET")
    s3_presign_expires_seconds: int = Field(
        86_400, alias="S3_PRESIGN_EXPIRES_SECONDS"
    )

    # Worker behavior
    work_dir: Path = Field(Path("/tmp/video_jobs"), alias="WORK_DIR")
    content_max_retries: int = 2

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )


def get_settings() -> Settings:
    """Convenience accessor for settings; inexpensive for pydantic-settings."""

    return Settings()  # type: ignore[call-arg]

