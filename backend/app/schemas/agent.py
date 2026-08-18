from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    personality: str | None = Field(default=None, max_length=1000)
    instructions: str | None = Field(default=None, max_length=4000)


class AgentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    personality: str | None = Field(default=None, max_length=1000)
    instructions: str | None = Field(default=None, max_length=4000)


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    name: str
    personality: str | None
    instructions: str | None
    created_at: datetime
