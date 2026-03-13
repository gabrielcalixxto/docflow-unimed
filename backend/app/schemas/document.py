from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import DocumentScope


class DocumentCreate(BaseModel):
    title: str
    company_id: int
    sector_id: int
    document_type: str
    scope: DocumentScope
    file_path: str
    expiration_date: date


class CompanyOption(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SectorOption(BaseModel):
    id: int
    name: str
    company_id: int

    model_config = ConfigDict(from_attributes=True)


class DocumentFormOptionsRead(BaseModel):
    companies: list[CompanyOption]
    sectors: list[SectorOption]
    document_types: list[str]
    scopes: list[DocumentScope]


class DocumentRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class DocumentDraftUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    file_path: str | None = Field(default=None, min_length=1, max_length=255)
    expiration_date: date | None = None


class DocumentRead(BaseModel):
    id: int
    code: str
    title: str
    company_id: int
    sector_id: int
    document_type: str
    scope: DocumentScope
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
