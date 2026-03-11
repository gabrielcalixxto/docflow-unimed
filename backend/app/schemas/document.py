from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import DocumentScope


class DocumentBase(BaseModel):
    code: str
    title: str
    company_id: int
    sector_id: int
    document_type: str
    scope: DocumentScope


class DocumentCreate(DocumentBase):
    pass


class DocumentRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class DocumentRead(DocumentBase):
    id: int
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
