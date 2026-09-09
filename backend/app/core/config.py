from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_secret_key: str
    gemini_api_key: str

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

    # How many past messages of a conversation are replayed to the model.
    #
    # Unbounded, this grew forever: the widget keeps one conversation id in
    # localStorage indefinitely, so a returning visitor resent their entire
    # history on every message, to two Gemini calls each time. Cost and
    # latency rose with the length of the relationship, and the eventual
    # end state is a hard failure when the context window is exceeded.
    #
    # 20 is ten exchanges, well beyond what a support question needs while
    # keeping the replayed history a predictable size. Must be at least 1:
    # the window includes the message just received, and a model call with
    # no user turn at all is an error.
    chat_history_messages: int = 20


# Loaded once, imported everywhere else
settings = Settings()
