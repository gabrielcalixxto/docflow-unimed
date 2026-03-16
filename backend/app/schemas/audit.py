from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogChangeRead(BaseModel):
    id: int
    field_name: str
    field_label: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    old_display_value: str | None = None
    new_display_value: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogRead(BaseModel):
    id: int
    created_at: datetime
    user_id: int | None = None
    user_name: str | None = None
    actor_name_snapshot: str | None = None
    document_id: int | None = None
    version_id: int | None = None
    entity_type: str
    entity_id: str
    entity_label: str | None = None
    action: str
    changes: list[AuditLogChangeRead] = Field(default_factory=list)
    request_id: str | None = None
    ip_address: str | None = None
    source_type: str | None = None
    source_url: str | None = None
    origin: str | None = None
    request_path: str | None = None
    request_method: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
