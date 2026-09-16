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

    # How many uvicorn worker processes / Railway replicas this deployment
    # actually runs. Not auto-detected: a worker can't see its siblings
    # from inside the process, and Railway's replica count is a dashboard
    # setting the app has no API to read. This exists purely so a human
    # has to change it, which is the point -- see rate_limit.py's
    # guard_single_instance() for what happens if it's raised above 1
    # without also moving the rate limiter to a shared store.
    expected_app_instances: int = 1

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

    # Lead notification email, over SMTP. See services/email.py.
    #
    # Entirely optional and off unless smtp_host and smtp_from are both
    # set, so an environment that does not configure it behaves exactly as
    # it did before this existed. Nothing in the chat path depends on it.
    #
    # SMTP rather than a provider SDK keeps this dependency-free and
    # provider-agnostic: a Gmail app password works, and so does Resend or
    # Postmark, by changing these values alone.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None

    # Bounded because sending happens on a worker thread: an unreachable
    # host would otherwise hang until the OS gives up, which can be
    # minutes.
    smtp_timeout_seconds: int = 10

    # Used to link the owner straight to the agent that captured the lead.
    # The link is simply omitted when this is unset, rather than pointing
    # somewhere wrong like localhost.
    dashboard_base_url: str | None = None


# Loaded once, imported everywhere else
settings = Settings()
