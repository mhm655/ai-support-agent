"""
Caps the size of every request body before anything parses it.

Why this exists
---------------
Nothing else did. FastAPI and uvicorn accept a body of any size, and the
Pydantic max_length checks on the schemas only run *after* the whole body
has been received and decoded. Verified on 2026-09-24 against a local
server: a 5MB JSON body posted to the unauthenticated chat route was read,
parsed and answered normally. Posting that in a loop costs the attacker
bandwidth and costs this server memory and CPU on every request.

The limits
----------
Document uploads get the upload ceiling from the documents router plus
room for multipart framing. Everything else is JSON whose largest
legitimate shape is an agent's instructions (4000 characters, which is
at most ~24KB even if every character arrives as a \\uXXXX escape), so
64KB leaves generous headroom without letting anyone stream megabytes.

Two cases, because a body can arrive two ways:
  * with Content-Length -- refused up front with a 413, nothing read;
  * chunked, with no length -- counted as it streams, and the request is
    ended as a client disconnect the moment it passes the limit.
"""

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.routers.documents import MAX_FILE_SIZE

DEFAULT_MAX_BODY = 64 * 1024
UPLOAD_MAX_BODY = MAX_FILE_SIZE + 1024 * 1024  # multipart boundaries and headers


def _limit_for(scope: Scope) -> int:
    if scope["method"] == "POST" and scope["path"].endswith("/documents"):
        return UPLOAD_MAX_BODY
    return DEFAULT_MAX_BODY


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = _limit_for(scope)

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None:
            try:
                too_big = int(declared) > limit
            except ValueError:
                too_big = True  # a length that is not a number is not honest
            if too_big:
                await _reject(send, limit)
                return

        received = 0

        async def counted_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    # Headers may already be on their way, so a 413 cannot
                    # be guaranteed here. Ending the body as a disconnect
                    # makes Starlette abandon the request, which is the part
                    # that matters: nothing more is buffered.
                    return {"type": "http.disconnect"}
            return message

        await self.app(scope, counted_receive, send)


async def _reject(send: Send, limit: int) -> None:
    body = json.dumps({"detail": f"Request body too large (max {limit // 1024}KB)"}).encode()
    await send({
        "type": "http.response.start",
        "status": 413,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})
