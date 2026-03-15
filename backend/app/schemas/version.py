from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import DocumentStatus


class DocumentVersionBase(BaseModel):
    version_number: int = Field(ge=1)
    status: DocumentStatus = DocumentStatus.RASCUNHO
    file_path: str
    expiration_date: date


class DocumentVersionCreate(DocumentVersionBase):
    @field_validator("expiration_date")
    @classmethod
    def validate_expiration_date(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Expiration date cannot be earlier than today.")
        return value


class DocumentVersionRead(DocumentVersionBase):
    id: int
    document_id: int
    created_by: int | None = None
    created_by_name: str | None = None
    approved_by: int | None = None
    approved_by_name: str | None = None
    invalidated_by: int | None = None
    invalidated_by_name: str | None = None
    created_at: datetime
    approved_at: datetime | None = None
    invalidated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
