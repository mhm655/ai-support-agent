from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.core.config import settings

# supabase-py's own default is 120s (postgrest.constants.DEFAULT_POSTGREST_CLIENT_TIMEOUT).
# chat_service.stream_chat_response runs as a sync generator inside
# StreamingResponse, which Starlette executes in a bounded thread pool -- a
# single call stuck for two minutes holds that thread for two minutes. Do
# that enough times (a network blip, a slow moment, anything) and the pool
# empties out; new requests then queue forever waiting for a thread that
# never frees up, which presents as the whole chat feature silently hanging
# with no error, for everyone, until the process is restarted. Individual
# Supabase calls are consistently sub-second; a bare Gemini call with a
# short prompt is too. But the real chat prompt carries full document
# context plus tool-calling config, and a query asking the model to
# enumerate several listings genuinely took >15s once measured end-to-end
# (confirmed via a live 504 DEADLINE_EXCEEDED from Gemini's own server at
# that threshold, not a guess) -- so 30s, not 15s: generous enough to cover
# real legitimate variance, still nowhere near "hangs forever."
CLIENT_TIMEOUT_SECONDS = 30


@lru_cache
def get_supabase() -> Client:
    """
    Server-side Supabase client using the secret key.
    This bypasses Row Level Security — the API layer (not RLS) is the
    authorization boundary for requests that go through FastAPI.
    Never expose this client or the secret key to the frontend.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_secret_key,
        options=ClientOptions(postgrest_client_timeout=CLIENT_TIMEOUT_SECONDS),
    )
