from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    # Stripped so a message of only spaces fails min_length instead of
    # being saved and sent to the model as an empty question.
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=2000)
    # A uuid is 36 characters; the route verifies the shape and ownership.
    # The cap only stops an oversized value being handled at all.
    conversation_id: str | None = Field(default=None, max_length=64)
    # Anonymous session id the widget generates and reuses (about 25
    # characters). Stored on every new conversation row, so without a cap
    # any caller could write arbitrarily large strings into the database.
    visitor_id: str | None = Field(default=None, max_length=100)
