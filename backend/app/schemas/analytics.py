from pydantic import BaseModel


class AnalyticsSummary(BaseModel):
    conversation_count: int
    message_count: int
    lead_count: int
    document_count: int
