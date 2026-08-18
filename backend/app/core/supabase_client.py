from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    """
    Server-side Supabase client using the secret key.
    This bypasses Row Level Security — the API layer (not RLS) is the
    authorization boundary for requests that go through FastAPI.
    Never expose this client or the secret key to the frontend.
    """
    return create_client(settings.supabase_url, settings.supabase_secret_key)
