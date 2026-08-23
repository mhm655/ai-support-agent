from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_secret_key: str
    # No longer required — JWKS-based verification (see core/security.py)
    # fetches the public key over HTTP instead of needing the shared secret.
    # Left optional rather than removed in case you ever need to fall back
    # to legacy HS256 verification.
    supabase_jwt_secret: str | None = None
    gemini_api_key: str
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# Loaded once, imported everywhere else
settings = Settings()
