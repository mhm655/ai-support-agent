from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import agents, analytics, businesses, conversations, documents, leads, public_chat
from app.core.config import settings

app = FastAPI(title="AI Support Agent API", version="0.1.0")

# CORS is open to every origin, for every route. That is a real decision,
# not an oversight, so it is worth stating plainly rather than implying a
# restriction that is not here: there is ONE middleware and it allows "*".
#
# It is safe specifically because this API authenticates with a Bearer
# token in the Authorization header and never with cookies. A browser
# attaches cookies to cross-origin requests on its own, which is what
# makes permissive CORS dangerous for cookie-based APIs; it will never
# attach an Authorization header on its own. A malicious site would need
# the token itself, which lives in the dashboard origin's localStorage and
# is unreachable from another origin. So restricting origins here would
# not block an attack that permissiveness allows.
#
# /public/* additionally *has* to be open: the embeddable widget runs on
# arbitrary customer websites, and the whole product depends on that.
#
# Revisit this if cookie-based auth is ever introduced anywhere. At that
# point allow_credentials would have to become True, and a wildcard origin
# combined with credentials is exactly the dangerous combination above.
# Note that Starlette's CORSMiddleware is global, so an actual per-route
# split would mean two mounted apps or custom middleware -- more machinery
# than the security benefit justifies today.
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
