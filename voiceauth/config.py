from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    APP_NAME: str = "Multilingual Voice Authentication System"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./voice_auth.db"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    ENCRYPTION_KEY: str

    OTP_EXPIRE_MINUTES: int = 5
    OTP_LENGTH: int = 6

    VOICE_SIMILARITY_THRESHOLD: float = 0.70
    LIVENESS_THRESHOLD: float = 0.70

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()