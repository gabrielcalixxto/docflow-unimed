from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.core.enums import DocumentScope, DocumentStatus


class WorkflowVersionRead(BaseModel):
    id: int
    document_id: int
    version_number: int
    status: DocumentStatus
    file_path: str
    created_by: int | None = None
    created_by_name: str | None = None
    approved_by: int | None = None
    approved_by_name: str | None = None
    invalidated_by: int | None = None
    invalidated_by_name: str | None = None
    created_at: datetime
    approved_at: datetime | None = None
    invalidated_at: datetime | None = None
    expiration_date: date

    model_config = ConfigDict(from_attributes=True)


class WorkflowDocumentRead(BaseModel):
    id: int
    code: str
    title: str
    company_id: int
    company_name: str | None = None
    sector_id: int
    sector_name: str | None = None
    document_type: str
    adjustment_comment: str | None = None
    adjustment_comment_by_name: str | None = None
    adjustment_reply_comment: str | None = None
    adjustment_reply_comment_by_name: str | None = None
    scope: DocumentScope
    created_by: int | None = None
    created_by_name: str | None = None
    created_at: datetime
    latest_status: DocumentStatus | None = None
    versions: list[WorkflowVersionRead]


class WorkflowDocumentListResponse(BaseModel):
    items: list[WorkflowDocumentRead]
    total: int
    page: int
    page_size: int
