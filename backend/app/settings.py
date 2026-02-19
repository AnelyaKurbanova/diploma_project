from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "api"
    ENV: str = "local"
    DEBUG: bool = True
    DATABASE_URL: str
    # JWT
    JWT_SECRET: str
    JWT_ALG: str = "HS256"
    JWT_ISSUER: str = "api"
    JWT_AUDIENCE: str = "web"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # OTP
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # SMTP
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "no-reply@example.com"
    SMTP_TLS: bool = True

    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str
    FRONTEND_REDIRECT_AFTER_GOOGLE: str = "http://localhost:3000/auth/callback"
    FRONTEND_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Cookies
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"  # lax|strict|none
    COOKIE_DOMAIN: str | None = None

    # Rate limit
    REDIS_URL: str | None = None
    RL_OTP_PER_EMAIL_PER_HOUR: int = 5
    RL_OTP_PER_IP_PER_HOUR: int = 20
    RL_VERIFY_PER_IP_PER_15MIN: int = 50
    RL_SUBMISSIONS_PER_USER_PER_MINUTE: int = 30

    SESSION_SECRET: str

    @field_validator("FRONTEND_ORIGINS", mode="before")
    @classmethod
    def parse_frontend_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value
    # LLM answer normalization (OpenAI)
    OPENAI_API_KEY: str | None = None
    LLM_MODEL_NAME: str = "gpt-4o-mini"
    LLM_NORMALIZER_TIMEOUT_SEC: float = 10.0

    # AWS S3 (problem images)
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str = "eu-north-1"
    S3_BUCKET: str = "ph8-bucket"

settings = Settings()
