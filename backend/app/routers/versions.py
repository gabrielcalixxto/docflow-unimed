from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.version import DocumentVersionCreate, DocumentVersionRead
from app.services.audit_service import AuditService
from app.services.version_service import VersionService

router = APIRouter(prefix="/documents", tags=["versions"])


def get_version_service(db: Session) -> VersionService:
    repository = VersionRepository(db)
    return VersionService(repository=repository, audit_service=AuditService())


@router.post("/{document_id}/versions", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    document_id: int,
    payload: DocumentVersionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_version_service(db)
    return service.create_version(document_id, payload, current_user)


@router.get("/{document_id}/versions", response_model=list[DocumentVersionRead])
def list_versions(
    document_id: int,
    _: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentVersionRead]:
    service = get_version_service(db)
    return service.list_versions(document_id)
