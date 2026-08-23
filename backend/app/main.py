from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import agents, analytics, businesses, conversations, documents, leads, public_chat
from app.core.config import settings

app = FastAPI(title="AI Support Agent API", version="0.1.0")

# CORS note: this API uses Bearer-token auth (Authorization header), not
# cookies — so allow_credentials doesn't need to be True, and we don't
# need per-route CORS configs. The dashboard origin is restricted via
# CORS_ORIGINS in .env; the /public/* chat endpoint additionally needs to
# be reachable from arbitrary business websites (that's the whole point
# of an embeddable widget), so it's allowed via "*" here too. Since no
# credentials/cookies are involved, this is a reasonable MVP posture —
# revisit before a real production launch if you add cookie-based auth
# anywhere.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(businesses.router)
app.include_router(agents.router)
app.include_router(documents.router)
app.include_router(conversations.router)
app.include_router(leads.router)
app.include_router(analytics.router)
app.include_router(public_chat.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
