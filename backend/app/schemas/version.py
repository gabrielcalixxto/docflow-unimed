from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import DocumentStatus


class DocumentVersionBase(BaseModel):
    version_number: int = Field(ge=1)
    status: DocumentStatus = DocumentStatus.RASCUNHO
    file_path: str
    expiration_date: date


class DocumentVersionCreate(DocumentVersionBase):
    pass


class DocumentVersionRead(DocumentVersionBase):
    id: int
    document_id: int
    created_by: int | None = None
    approved_by: int | None = None
    created_at: datetime
    approved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
