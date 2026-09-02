"""
Shared pytest fixtures for the backend test suite.

Settings() (app/core/config.py) requires SUPABASE_URL, SUPABASE_SECRET_KEY,
and GEMINI_API_KEY with no defaults, and is instantiated at import time —
so real env vars (or a real .env) would otherwise be required just to
import app code. These dummy values are set before any `app.*` module is
imported, so every test runs fully offline with no real Supabase/Gemini
credentials and never touches the real services.
"""

import os

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test_dummy")
os.environ.setdefault("GEMINI_API_KEY", "test-dummy-gemini-key")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

from unittest.mock import MagicMock  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import CurrentUser, get_current_business_id, get_current_user  # noqa: E402
from app.main import app  # noqa: E402

TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_BUSINESS_ID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def mock_current_user():
    return CurrentUser(user_id=TEST_USER_ID, email="owner@example.com")


@pytest.fixture
def authed_client(mock_current_user):
    """
    A TestClient where auth is pre-satisfied: get_current_user and
    get_current_business_id are overridden so router tests can focus on
    the route's own logic instead of re-proving JWT verification (that's
    covered separately in test_security.py).
    """
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    app.dependency_overrides[get_current_business_id] = lambda: TEST_BUSINESS_ID
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """A plain TestClient with no auth overrides, for unauthenticated routes."""
    with TestClient(app) as c:
        yield c


def make_supabase_mock(table_response_data):
    """
    Builds a MagicMock that mimics the small slice of the supabase-py
    fluent query builder this codebase uses:
    `.table(...).select(...).eq(...).limit(...).execute()` etc.

    Every chained method returns the same mock so any call chain works;
    `.execute()` returns an object with a `.data` attribute, matching
    what supabase-py's PostgrestResponse actually looks like.
    """
    mock = MagicMock()
    mock.table.return_value = mock
    mock.select.return_value = mock
    mock.insert.return_value = mock
    mock.update.return_value = mock
    mock.delete.return_value = mock
    mock.eq.return_value = mock
    mock.limit.return_value = mock
    mock.order.return_value = mock
    mock.execute.return_value = MagicMock(data=table_response_data)
    return mock
