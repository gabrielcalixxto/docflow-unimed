from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import AuditContext, get_audit_context
from app.core.database import get_db
from app.core.realtime import build_realtime_event, realtime_broker
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.document_event_repository import DocumentEventRepository
from app.repositories.stored_file_repository import StoredFileRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.errors import build_standard_error_responses
from app.schemas.version import DocumentVersionCreate, DocumentVersionRead
from app.services.audit_service import AuditService
from app.services.errors import ServiceError
from app.services.version_service import VersionService

router = APIRouter(prefix="/documents", tags=["Document Versions"])

VERSION_MUTATION_ERRORS = build_standard_error_responses(401, 403, 404, 409, 422, 500)
VERSION_QUERY_ERRORS = build_standard_error_responses(401, 403, 404, 422, 500)


def get_version_service(db: Session) -> VersionService:
    return VersionService(
        repository=VersionRepository(db),
        document_repository=DocumentRepository(db),
        file_repository=StoredFileRepository(db),
        audit_service=AuditService(
            repository=DocumentEventRepository(db),
            log_repository=AuditLogRepository(db),
        ),
    )


@router.post(
    "/{document_id}/versions",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova versão de documento",
    description="Cria nova versão em rascunho para o documento informado.",
    responses=VERSION_MUTATION_ERRORS,
)
def create_version(
    document_id: int,
    payload: DocumentVersionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_version_service(db)
    try:
        response = service.create_version(document_id, payload, current_user, audit_context=audit_context)
        realtime_broker.publish(
            build_realtime_event(
                channel="workflow",
                action="document_version_created",
                user_id=current_user.user_id,
                document_id=document_id,
                entity_type="document",
                entity_id=document_id,
            )
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/{document_id}/versions",
    response_model=list[DocumentVersionRead],
    summary="Listar versões de documento",
    description="Retorna histórico de versões do documento com metadados de aprovação e invalidação.",
    responses=VERSION_QUERY_ERRORS,
)
def list_versions(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentVersionRead]:
    service = get_version_service(db)
    try:
        return service.list_versions(document_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
