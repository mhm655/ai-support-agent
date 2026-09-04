"""
Tests for the chat model fallback chain.

This logic only runs when a provider is failing, which is exactly when it
is hardest to exercise by hand -- the outage on 2026-09-04 was the first
time it would have mattered, and by then it did not exist. So it is worth
covering properly rather than trusting to a live incident.
"""

import httpx
import pytest
from google.genai import errors as genai_errors

from app.services import chat_service


def _server_error(code: int = 503) -> genai_errors.ServerError:
    response = httpx.Response(
        status_code=code,
        json={"error": {"code": code, "message": "overloaded", "status": "UNAVAILABLE"}},
        request=httpx.Request("POST", "https://example.invalid"),
    )
    return genai_errors.ServerError(code, response.json(), response)


def _client_error(code: int = 429) -> genai_errors.ClientError:
    response = httpx.Response(
        status_code=code,
        json={"error": {"code": code, "message": "quota", "status": "RESOURCE_EXHAUSTED"}},
        request=httpx.Request("POST", "https://example.invalid"),
    )
    return genai_errors.ClientError(code, response.json(), response)


class _Reply:
    def __init__(self, text: str) -> None:
        self.text = text
        self.function_calls = []


class _FakeModels:
    """Fails for every model named in `failing`, succeeds otherwise."""

    def __init__(self, failing: dict[str, Exception]) -> None:
        self.failing = failing
        self.calls: list[str] = []

    def generate_content(self, *, model, contents, config):
        self.calls.append(model)
        if model in self.failing:
            raise self.failing[model]
        return _Reply(f"reply from {model}")

    def generate_content_stream(self, *, model, contents, config):
        self.calls.append(model)
        if model in self.failing:
            raise self.failing[model]
        return iter([_Reply("hello "), _Reply("world")])


class _FakeClient:
    def __init__(self, failing: dict[str, Exception]) -> None:
        self.models = _FakeModels(failing)


# --- _is_transient ---------------------------------------------------------


def test_5xx_is_transient():
    assert chat_service._is_transient(_server_error(503)) is True
    assert chat_service._is_transient(_server_error(504)) is True


def test_429_is_transient():
    assert chat_service._is_transient(_client_error(429)) is True


def test_other_client_errors_are_not_transient():
    # A 400 fails identically on every model; walking the chain would just
    # triple the latency of an error the caller is getting regardless.
    assert chat_service._is_transient(_client_error(400)) is False


def test_unrelated_exceptions_are_not_transient():
    assert chat_service._is_transient(ValueError("nope")) is False


# --- non-streaming fallback ------------------------------------------------


def test_generate_falls_back_to_second_model():
    client = _FakeClient({chat_service.CHAT_MODEL: _server_error()})
    result = chat_service._generate_with_fallback(client, [], None)

    assert result.text == "reply from gemini-3.5-flash"
    assert client.models.calls == [
        chat_service.CHAT_MODEL,
        "gemini-3.5-flash",
    ]


def test_generate_uses_primary_when_healthy():
    client = _FakeClient({})
    result = chat_service._generate_with_fallback(client, [], None)

    assert result.text == f"reply from {chat_service.CHAT_MODEL}"
    assert client.models.calls == [chat_service.CHAT_MODEL]


def test_generate_raises_when_whole_chain_is_down():
    # The 2026-09-04 case: every model 5xx at once.
    client = _FakeClient({m: _server_error() for m in chat_service.CHAT_MODEL_CHAIN})

    with pytest.raises(genai_errors.ServerError):
        chat_service._generate_with_fallback(client, [], None)

    assert client.models.calls == list(chat_service.CHAT_MODEL_CHAIN)


def test_generate_does_not_walk_chain_on_non_transient_error():
    client = _FakeClient({m: _client_error(400) for m in chat_service.CHAT_MODEL_CHAIN})

    with pytest.raises(genai_errors.ClientError):
        chat_service._generate_with_fallback(client, [], None)

    assert client.models.calls == [chat_service.CHAT_MODEL]


# --- streaming fallback ----------------------------------------------------


def test_stream_falls_back_before_first_token():
    client = _FakeClient({chat_service.CHAT_MODEL: _server_error()})

    deltas = list(chat_service._stream_with_fallback(client, [], None))

    assert deltas == ["hello ", "world"]
    assert client.models.calls == [chat_service.CHAT_MODEL, "gemini-3.5-flash"]


def test_stream_does_not_fall_back_after_a_token_was_emitted():
    """
    Switching models mid-reply would splice two different answers together
    in front of the visitor, so a failure after the first token must
    propagate rather than restart on another model.
    """

    class _HalfBrokenModels(_FakeModels):
        def generate_content_stream(self, *, model, contents, config):
            self.calls.append(model)

            def gen():
                yield _Reply("first ")
                raise _server_error()

            return gen()

    client = _FakeClient({})
    client.models = _HalfBrokenModels({})

    produced = []
    with pytest.raises(genai_errors.ServerError):
        for delta in chat_service._stream_with_fallback(client, [], None):
            produced.append(delta)

    assert produced == ["first "]
    assert client.models.calls == [chat_service.CHAT_MODEL]
