from pydantic_settings import BaseSettings, SettingsConfigDict

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

    # Cookies
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"  # lax|strict|none
    COOKIE_DOMAIN: str | None = None

    # Rate limit
    REDIS_URL: str | None = None
    RL_OTP_PER_EMAIL_PER_HOUR: int = 5
    RL_OTP_PER_IP_PER_HOUR: int = 20
    RL_VERIFY_PER_IP_PER_15MIN: int = 50

    SESSION_SECRET: str

settings = Settings()
