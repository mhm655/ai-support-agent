from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BusinessCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)


class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auth_user_id: str
    name: str
    created_at: datetime
