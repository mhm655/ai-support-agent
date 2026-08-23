from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    conversation_id: str | None
    name: str | None
    email: str | None
    phone: str | None
    interest: str | None
    created_at: datetime
