from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import DocumentEventType, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document_version import DocumentVersion
from app.repositories.document_repository import DocumentRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.version import DocumentVersionCreate
from app.services.audit_service import AuditService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class VersionService:
    def __init__(
        self,
        repository: VersionRepository,
        document_repository: DocumentRepository,
        audit_service: AuditService,
    ):
        self.repository = repository
        self.document_repository = document_repository
        self.audit_service = audit_service

    def create_version(
        self,
        document_id: int,
        payload: DocumentVersionCreate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_write(current_user)

        document = self.document_repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        if payload.status != DocumentStatus.RASCUNHO:
            raise ConflictServiceError("New versions must start as draft (RASCUNHO).")

        if self.repository.get_version_by_number(
            document_id=document_id,
            version_number=payload.version_number,
        ) is not None:
            raise ConflictServiceError(
                f"Version number {payload.version_number} already exists for document {document_id}."
            )

        try:
            version = self.repository.create_version(
                document_id=document_id,
                payload=payload,
                created_by=current_user.user_id,
            )
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.VERSION_CREATED,
                document_id=document_id,
                version_id=version.id,
                user_id=current_user.user_id,
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create document version.") from exc

        return MessageResponse(message=f"Version {payload.version_number} created successfully.")

    def list_versions(self, document_id: int) -> list[DocumentVersion]:
        return self.repository.list_versions_for_document(document_id)

    @staticmethod
    def _ensure_authenticated_user_id(current_user: AuthenticatedUser) -> None:
        if current_user.user_id is None:
            raise ForbiddenServiceError("Authenticated user must include a valid user id.")

    @staticmethod
    def _ensure_can_write(current_user: AuthenticatedUser) -> None:
        if not current_user.has_any_role({UserRole.AUTOR, UserRole.REVISOR, UserRole.COORDENADOR}):
            raise ForbiddenServiceError("Only author, reviewer, or coordinator can create versions.")
