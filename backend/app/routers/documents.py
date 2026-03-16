from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.audit import AuditContext, get_audit_context
from app.core.database import get_db
from app.core.enums import DocumentScope, DocumentStatus
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.document_event_repository import DocumentEventRepository
from app.repositories.stored_file_repository import StoredFileRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.audit import AuditLogListResponse
from app.schemas.common import MessageResponse
from app.schemas.document import (
    DocumentCreate,
    DocumentDraftUpdate,
    DocumentFormOptionsRead,
    DocumentRead,
    DocumentRejectRequest,
)
from app.schemas.workflow import WorkflowDocumentListResponse
from app.services.audit_service import AuditService
from app.services.document_service import DocumentService
from app.services.errors import ServiceError

router = APIRouter(prefix="/documents", tags=["documents"])


def get_document_service(db: Session) -> DocumentService:
    return DocumentService(
        repository=DocumentRepository(db),
        version_repository=VersionRepository(db),
        file_repository=StoredFileRepository(db),
        auth_repository=AuthRepository(db),
        audit_service=AuditService(
            repository=DocumentEventRepository(db),
            log_repository=AuditLogRepository(db),
        ),
    )


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.create_document(payload, current_user, audit_context=audit_context)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/form-options", response_model=DocumentFormOptionsRead)
def get_document_form_options(
    _: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentFormOptionsRead:
    service = get_document_service(db)
    return service.get_form_options()


@router.get("", response_model=list[DocumentRead])
def list_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    service = get_document_service(db)
    try:
        return service.list_documents(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/workflow", response_model=WorkflowDocumentListResponse)
def list_workflow_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    term: str | None = Query(default=None),
    company_id: int | None = Query(default=None),
    sector_id: int | None = Query(default=None),
    document_type: str | None = Query(default=None),
    scope: DocumentScope | None = Query(default=None),
    latest_status: DocumentStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> WorkflowDocumentListResponse:
    service = get_document_service(db)
    try:
        return service.list_workflow_documents(
            current_user,
            term=term,
            company_id=company_id,
            sector_id=sector_id,
            document_type=document_type,
            scope=scope,
            latest_status=latest_status,
            page=page,
            page_size=page_size,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{document_id}/events", response_model=AuditLogListResponse)
def get_document_events(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    term: str | None = Query(default=None),
    action: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> AuditLogListResponse:
    service = get_document_service(db)
    try:
        return service.list_document_events(
            document_id,
            current_user,
            term=term,
            action=action,
            user_id=user_id,
            page=page,
            page_size=page_size,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    service = get_document_service(db)
    try:
        document = service.get_document(document_id, current_user)
        if document is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
        return document
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.patch("/{document_id}/draft", response_model=MessageResponse)
def update_draft_document(
    document_id: int,
    payload: DocumentDraftUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.update_draft_document(document_id, payload, current_user, audit_context=audit_context)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete("/{document_id}/draft", response_model=MessageResponse)
def delete_draft_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.delete_draft_document(document_id, current_user, audit_context=audit_context)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{document_id}/submit-review", response_model=MessageResponse)
def submit_review(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.submit_for_review(document_id, current_user, audit_context=audit_context)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{document_id}/approve", response_model=MessageResponse)
def approve_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.approve_document(document_id, current_user, audit_context=audit_context)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{document_id}/reject", response_model=MessageResponse)
def reject_document(
    document_id: int,
    payload: DocumentRejectRequest | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        reason = payload.reason if payload is not None else None
        return service.reject_document(document_id, current_user, reason=reason, audit_context=audit_context)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
