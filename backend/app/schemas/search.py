from datetime import date

from pydantic import BaseModel

from app.core.enums import DocumentScope


class DocumentSearchResult(BaseModel):
    document_id: int
    code: str
    title: str
    document_type: str
    scope: DocumentScope
    active_version_id: int
    active_version_number: int
    file_path: str
    expiration_date: date


class DocumentSearchResponse(BaseModel):
    items: list[DocumentSearchResult]
