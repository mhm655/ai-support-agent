from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    visitor_id: str | None = None  # anonymous session id the widget generates and reuses
