from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import DocumentEventType, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate
from app.services.audit_service import AuditService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        version_repository: VersionRepository,
        auth_repository: AuthRepository,
        audit_service: AuditService,
    ):
        self.repository = repository
        self.version_repository = version_repository
        self.auth_repository = auth_repository
        self.audit_service = audit_service

    def create_document(self, payload: DocumentCreate, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_write(current_user)

        try:
            document = self.repository.create_document(payload=payload, created_by=current_user.user_id)
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.DOCUMENT_CREATED,
                document_id=document.id,
                user_id=current_user.user_id,
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create document with the provided data.") from exc

        return MessageResponse(message=f"Document created successfully (id={document.id}).")

    def list_documents(self) -> list[Document]:
        return self.repository.list_documents()

    def get_document(self, document_id: int) -> Document | None:
        return self.repository.get_document_by_id(document_id)

    def submit_for_review(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_write(current_user)

        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to submit.")

        if latest_version.status != DocumentStatus.RASCUNHO:
            raise ConflictServiceError("Only draft versions can be submitted for review.")

        try:
            latest_version.status = DocumentStatus.EM_REVISAO
            self.version_repository.save(latest_version)
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.SUBMITTED_FOR_REVIEW,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not submit document for review.") from exc

        return MessageResponse(message="Document submitted for review.")

    def approve_document(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_approve(current_user, document_id=document_id)

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to approve.")

        if latest_version.status != DocumentStatus.EM_REVISAO:
            raise ConflictServiceError("Only versions in review can be approved.")

        active_version = self.version_repository.get_active_version_for_document(document_id)

        try:
            if active_version is not None and active_version.id != latest_version.id:
                active_version.status = DocumentStatus.OBSOLETO
                self.version_repository.save(active_version)
                self.audit_service.create_placeholder_event(
                    event_type=DocumentEventType.MARKED_OBSOLETE,
                    document_id=document_id,
                    version_id=active_version.id,
                    user_id=current_user.user_id,
                )

            latest_version.status = DocumentStatus.VIGENTE
            latest_version.approved_by = current_user.user_id
            latest_version.approved_at = datetime.now(UTC)
            self.version_repository.save(latest_version)

            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.APPROVED,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.SET_TO_VIGENTE,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not approve document version.") from exc

        return MessageResponse(message="Document approved and set as active version.")

    def reject_document(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
        *,
        reason: str | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_approve(current_user, document_id=document_id)

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to reject.")

        if latest_version.status != DocumentStatus.EM_REVISAO:
            raise ConflictServiceError("Only versions in review can be rejected.")

        try:
            latest_version.status = DocumentStatus.RASCUNHO
            latest_version.approved_by = None
            latest_version.approved_at = None
            self.version_repository.save(latest_version)

            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.REJECTED,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not reject document version.") from exc

        if reason and reason.strip():
            return MessageResponse(
                message=f"Document review rejected and returned to draft. Reason: {reason.strip()}"
            )

        return MessageResponse(message="Document review rejected and returned to draft.")

    @staticmethod
    def _ensure_authenticated_user_id(current_user: AuthenticatedUser) -> None:
        if current_user.user_id is None:
            raise ForbiddenServiceError("Authenticated user must include a valid user id.")

    @staticmethod
    def _ensure_can_write(current_user: AuthenticatedUser) -> None:
        if current_user.role == UserRole.LEITOR:
            raise ForbiddenServiceError("Reader role cannot modify documents.")

    def _ensure_can_approve(self, current_user: AuthenticatedUser, *, document_id: int) -> None:
        if current_user.role not in {UserRole.COORDENADOR, UserRole.ADMIN}:
            raise ForbiddenServiceError("Only coordinator or admin can approve documents.")

        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        if current_user.role == UserRole.ADMIN:
            return

        user = self.auth_repository.get_user_by_id(current_user.user_id)
        if user is None:
            raise ForbiddenServiceError("Authenticated coordinator was not found in database.")

        # Only enforce sector matching when both sides are explicitly configured.
        if user.sector_id is not None and document.sector_id != user.sector_id:
            raise ForbiddenServiceError("Coordinator can only approve documents from the same sector.")
