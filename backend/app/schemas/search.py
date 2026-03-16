from datetime import date, datetime

from pydantic import BaseModel

from app.core.enums import DocumentScope


class DocumentSearchResult(BaseModel):
    document_id: int
    code: str
    title: str
    created_by: int | None = None
    created_by_name: str | None = None
    company_id: int
    sector_id: int
    document_type: str
    scope: DocumentScope
    active_version_id: int
    active_version_number: int
    file_path: str
    expiration_date: date
    approved_by: int | None = None
    approved_by_name: str | None = None
    approved_at: datetime | None = None


class DocumentSearchResponse(BaseModel):
    items: list[DocumentSearchResult]
