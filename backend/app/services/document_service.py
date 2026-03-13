from datetime import UTC, datetime
import re
import unicodedata

from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import DocumentEventType, DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate, DocumentFormOptionsRead
from app.schemas.version import DocumentVersionCreate
from app.services.audit_service import AuditService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError

DEFAULT_DOCUMENT_TYPES = ("POP", "IT", "MANUAL", "POLITICA", "PROTOCOLO")


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

        company = self.repository.get_company_by_id(payload.company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        sector = self.repository.get_sector_by_id(payload.sector_id)
        if sector is None:
            raise NotFoundServiceError("Sector not found.")

        if sector.company_id != company.id:
            raise ConflictServiceError("Selected sector does not belong to selected company.")

        try:
            document = self.repository.create_document(
                payload=payload,
                code="PENDING",
                created_by=current_user.user_id,
            )
            document.code = self._build_document_code(
                document_type=payload.document_type,
                document_id=document.id,
                sector_name=sector.name,
            )
            self.repository.save(document)

            initial_version = self.version_repository.create_version(
                document_id=document.id,
                payload=DocumentVersionCreate(
                    version_number=1,
                    status=DocumentStatus.RASCUNHO,
                    file_path=payload.file_path,
                    expiration_date=payload.expiration_date,
                ),
                created_by=current_user.user_id,
            )
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.DOCUMENT_CREATED,
                document_id=document.id,
                user_id=current_user.user_id,
            )
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.VERSION_CREATED,
                document_id=document.id,
                version_id=initial_version.id,
                user_id=current_user.user_id,
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create document with the provided data.") from exc

        return MessageResponse(
            message=f"Document created successfully (id={document.id}, code={document.code}, version=1)."
        )

    def get_form_options(self) -> DocumentFormOptionsRead:
        companies = self.repository.list_companies()
        sectors = self.repository.list_sectors()
        existing_document_types = self.repository.list_distinct_document_types()
        normalized_defaults = [item.strip().upper() for item in DEFAULT_DOCUMENT_TYPES]
        normalized_existing = [item.strip().upper() for item in existing_document_types if item and item.strip()]

        document_types: list[str] = []
        for item in [*normalized_defaults, *normalized_existing]:
            if item not in document_types:
                document_types.append(item)

        return DocumentFormOptionsRead(
            companies=companies,
            sectors=sectors,
            document_types=document_types,
            scopes=list(DocumentScope),
        )

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

    @staticmethod
    def _build_document_code(*, document_type: str, document_id: int, sector_name: str) -> str:
        normalized_type = DocumentService._slug_segment(document_type) or "DOC"
        normalized_sector = DocumentService._slug_segment(sector_name) or "SET"
        sector_part = normalized_sector[:3].ljust(3, "X")
        return f"{normalized_type}-{document_id}-{sector_part}"

    @staticmethod
    def _slug_segment(value: str) -> str:
        stripped = unicodedata.normalize("NFKD", value or "")
        ascii_only = stripped.encode("ascii", "ignore").decode("ascii")
        clean = re.sub(r"[^A-Za-z0-9]+", "", ascii_only)
        return clean.upper()
