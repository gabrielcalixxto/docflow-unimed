from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit import AuditLogListResponse
from app.services.audit_log_service import AuditLogService
from app.services.audit_service import AuditService
from app.services.errors import ServiceError

router = APIRouter(prefix="/audit", tags=["audit"])


def get_audit_log_service(db: Session = Depends(get_db)) -> AuditLogService:
    return AuditLogService(audit_service=AuditService(log_repository=AuditLogRepository(db)))


@router.get("/events", response_model=AuditLogListResponse)
def list_audit_events(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    term: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    document_id: int | None = Query(default=None),
    request_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> AuditLogListResponse:
    service = get_audit_log_service(db)
    try:
        return service.list_logs(
            current_user=current_user,
            term=term,
            entity_type=entity_type,
            action=action,
            user_id=user_id,
            document_id=document_id,
            request_id=request_id,
            page=page,
            page_size=page_size,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
