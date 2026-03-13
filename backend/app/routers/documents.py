from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate, DocumentFormOptionsRead, DocumentRead, DocumentRejectRequest
from app.services.audit_service import AuditService
from app.services.document_service import DocumentService
from app.services.errors import ServiceError

router = APIRouter(prefix="/documents", tags=["documents"])


def get_document_service(db: Session) -> DocumentService:
    return DocumentService(
        repository=DocumentRepository(db),
        version_repository=VersionRepository(db),
        auth_repository=AuthRepository(db),
        audit_service=AuditService(),
    )


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.create_document(payload, current_user)
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
    _: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    service = get_document_service(db)
    return service.list_documents()


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int,
    _: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    service = get_document_service(db)
    document = service.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


@router.post("/{document_id}/submit-review", response_model=MessageResponse)
def submit_review(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.submit_for_review(document_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{document_id}/approve", response_model=MessageResponse)
def approve_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        return service.approve_document(document_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{document_id}/reject", response_model=MessageResponse)
def reject_document(
    document_id: int,
    payload: DocumentRejectRequest | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        reason = payload.reason if payload is not None else None
        return service.reject_document(document_id, current_user, reason=reason)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
