from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DocFlow API"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/docflow"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    seed_default_users: bool = True
    seed_default_password: str = "123"
    debug_sql: bool = False
    log_level: str = "INFO"
    log_requests: bool = True
    log_response_body: bool = True
    log_response_body_max_chars: int = 1200
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
