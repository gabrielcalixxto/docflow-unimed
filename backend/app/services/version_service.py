import re

from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import DocumentEventType, DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.repositories.document_repository import DocumentRepository
from app.repositories.stored_file_repository import StoredFileRepository
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
        file_repository: StoredFileRepository | None = None,
    ):
        self.repository = repository
        self.document_repository = document_repository
        self.audit_service = audit_service
        self.file_repository = file_repository

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
        self._ensure_can_access_document(current_user, document)

        if payload.status != DocumentStatus.RASCUNHO:
            raise ConflictServiceError("New versions must start as draft (RASCUNHO).")

        latest_version = self.repository.get_latest_version_for_document(document_id)
        if latest_version is not None and latest_version.status in {
            DocumentStatus.RASCUNHO,
            DocumentStatus.REVISAR_RASCUNHO,
            DocumentStatus.PENDENTE_COORDENACAO,
            DocumentStatus.EM_REVISAO,
        }:
            raise ConflictServiceError(
                "There is already a version in progress for this document."
            )

        next_version_number = 1 if latest_version is None else int(latest_version.version_number) + 1
        create_payload = payload.model_copy(
            update={
                "version_number": next_version_number,
                "status": DocumentStatus.RASCUNHO,
            }
        )

        try:
            version = self.repository.create_version(
                document_id=document_id,
                payload=create_payload,
                created_by=current_user.user_id,
            )
            self._attach_uploaded_file_to_version(
                file_path=payload.file_path,
                document_id=document_id,
                version_id=version.id,
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

        return MessageResponse(message=f"Version {next_version_number} created successfully.")

    def list_versions(self, document_id: int, current_user: AuthenticatedUser) -> list[DocumentVersion]:
        self._ensure_can_access_document_registry(current_user)
        document = self.document_repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")
        self._ensure_can_access_document(current_user, document)
        return self.repository.list_versions_for_document(document_id)

    @staticmethod
    def _ensure_authenticated_user_id(current_user: AuthenticatedUser) -> None:
        if current_user.user_id is None:
            raise ForbiddenServiceError("Authenticated user must include a valid user id.")

    @staticmethod
    def _ensure_can_write(current_user: AuthenticatedUser) -> None:
        if not current_user.has_any_role({UserRole.AUTOR, UserRole.REVISOR, UserRole.COORDENADOR}):
            raise ForbiddenServiceError("Only author, reviewer, or coordinator can create versions.")

    @staticmethod
    def _ensure_can_access_document_registry(current_user: AuthenticatedUser) -> None:
        if not current_user.has_any_role({UserRole.AUTOR, UserRole.REVISOR, UserRole.COORDENADOR, UserRole.ADMIN}):
            raise ForbiddenServiceError("Only non-reader roles can access document versions.")

    @staticmethod
    def _ensure_can_access_document(current_user: AuthenticatedUser, document: Document) -> None:
        if document.scope == DocumentScope.CORPORATIVO:
            return
        if document.scope == DocumentScope.LOCAL and document.sector_id in current_user.normalized_sector_ids():
            return
        raise ForbiddenServiceError("You do not have permission to access this document.")

    def _attach_uploaded_file_to_version(self, *, file_path: str, document_id: int, version_id: int) -> None:
        storage_key = self._extract_storage_key(file_path)
        if storage_key is None:
            return
        self.file_repository.attach_to_version(
            storage_key=storage_key,
            document_id=document_id,
            version_id=version_id,
        )

    @staticmethod
    def _extract_storage_key(file_path: str) -> str | None:
        value = (file_path or "").strip()
        prefix = "/file-storage/"
        if not value.startswith(prefix):
            return None
        storage_key = value[len(prefix) :]
        if not storage_key:
            return None
        if not re.fullmatch(r"[A-Fa-f0-9]{32}", storage_key):
            return None
        return storage_key.lower()
