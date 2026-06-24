from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CrewOps"
    environment: str = "development"
    secret_key: str = "dev-change-me"
    access_token_expire_minutes: int = 720
    database_url: str = "sqlite:///./crewops.db"
    upload_dir: str = "./uploads"
    backup_dir: str = "./backups"
    cors_origins: List[str] = ["http://localhost:8088", "http://localhost:8000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self):
        weak_secrets = {
            "dev-change-me",
            "change-me",
            "change-me-to-a-long-random-secret",
            "replace-with-a-long-random-secret",
        }
        if self.environment.lower() == "production" and (self.secret_key in weak_secrets or len(self.secret_key) < 32):
            raise ValueError("SECRET_KEY must be set to a strong unique value of at least 32 characters in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
