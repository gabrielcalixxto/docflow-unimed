from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.document_repository import DocumentRepository
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate, DocumentRead
from app.services.audit_service import AuditService
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["documents"])


def get_document_service(db: Session) -> DocumentService:
    repository = DocumentRepository(db)
    return DocumentService(repository=repository, audit_service=AuditService())


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    return service.create_document(payload, current_user)


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
    return service.submit_for_review(document_id, current_user)


@router.post("/{document_id}/approve", response_model=MessageResponse)
def approve_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    return service.approve_document(document_id, current_user)
