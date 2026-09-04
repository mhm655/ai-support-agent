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

    # Rate limits for the unauthenticated /public chat endpoint. See
    # core/rate_limit.py for why these exist and what they do not cover.
    #
    # The per-IP limit is sized for a human typing in a chat bubble: eight
    # messages a minute is faster than anyone converses, so a real visitor
    # will not meet it.
    #
    # The per-agent limit is the one protecting the business owner's Gemini
    # quota. It has to allow a genuinely busy site while still capping the
    # damage a scraped agent_id can do, and 60/minute is well above real
    # traffic for a small business while bounding spend.
    #
    # Set either to 0 to disable that limit.
    public_chat_per_ip_per_minute: int = 8
    public_chat_per_agent_per_minute: int = 60

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# Loaded once, imported everywhere else
settings = Settings()
