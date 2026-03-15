from datetime import UTC, datetime
import re
import unicodedata

from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import DocumentEventType, DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.stored_file_repository import StoredFileRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate, DocumentDraftUpdate, DocumentFormOptionsRead
from app.schemas.version import DocumentVersionCreate
from app.services.audit_service import AuditService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        version_repository: VersionRepository,
        auth_repository: AuthRepository,
        audit_service: AuditService,
        file_repository: StoredFileRepository | None = None,
    ):
        self.repository = repository
        self.version_repository = version_repository
        self.auth_repository = auth_repository
        self.audit_service = audit_service
        self.file_repository = file_repository

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
                sector_sigla=getattr(sector, "sigla", None),
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
            self._attach_uploaded_file_to_version(
                file_path=payload.file_path,
                document_id=document.id,
                version_id=initial_version.id,
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
        configured_document_types = self.repository.list_document_types()
        existing_document_types = self.repository.list_distinct_document_types()
        document_type_options: list[dict[str, str]] = []
        seen_siglas: set[str] = set()

        for item in configured_document_types:
            sigla_raw = getattr(item, "sigla", None)
            if not sigla_raw or not str(sigla_raw).strip():
                continue
            sigla = str(sigla_raw).strip().upper()
            if sigla in seen_siglas:
                continue
            seen_siglas.add(sigla)
            name_raw = getattr(item, "name", None)
            name = str(name_raw).strip() if name_raw else sigla
            document_type_options.append({"sigla": sigla, "name": name or sigla})

        normalized_existing = [item.strip().upper() for item in existing_document_types if item and item.strip()]
        for sigla in normalized_existing:
            if sigla in seen_siglas:
                continue
            seen_siglas.add(sigla)
            document_type_options.append({"sigla": sigla, "name": sigla})

        document_types = [item["sigla"] for item in document_type_options]

        return DocumentFormOptionsRead(
            companies=companies,
            sectors=sectors,
            document_types=document_types,
            document_type_options=document_type_options,
            scopes=list(DocumentScope),
        )

    def list_documents(self) -> list[Document]:
        return self.repository.list_documents()

    def get_document(self, document_id: int) -> Document | None:
        return self.repository.get_document_by_id(document_id)

    def update_draft_document(
        self,
        document_id: int,
        payload: DocumentDraftUpdate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        document, latest_version = self._get_editable_draft(document_id, current_user)

        document_changed = False
        version_changed = False

        if payload.title is not None:
            title = payload.title.strip()
            if not title:
                raise ConflictServiceError("Title cannot be empty.")
            document.title = title
            document_changed = True

        if payload.file_path is not None:
            file_path = payload.file_path.strip()
            if not file_path:
                raise ConflictServiceError("File path cannot be empty.")
            latest_version.file_path = file_path
            version_changed = True

        if payload.expiration_date is not None:
            latest_version.expiration_date = payload.expiration_date
            version_changed = True

        if not document_changed and not version_changed:
            raise ConflictServiceError("Provide at least one field to update.")

        try:
            if document_changed:
                self.repository.save(document)
            if version_changed:
                self.version_repository.save(latest_version)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update draft document.") from exc

        return MessageResponse(message="Draft document updated successfully.")

    def delete_draft_document(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        document, _ = self._get_editable_draft(document_id, current_user)

        try:
            self.repository.delete(document)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete draft document.") from exc

        return MessageResponse(message="Draft document deleted successfully.")

    def submit_for_review(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_submit_for_review(current_user)

        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to submit.")

        if latest_version.status not in {DocumentStatus.RASCUNHO, DocumentStatus.REVISAR_RASCUNHO}:
            raise ConflictServiceError(
                "Only draft versions (RASCUNHO or REVISAR_RASCUNHO) can be submitted for coordinator approval."
            )

        try:
            latest_version.status = DocumentStatus.PENDENTE_COORDENACAO
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

        return MessageResponse(message="Document moved to coordinator approval queue.")

    def approve_document(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_approve(current_user, document_id=document_id)

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to approve.")

        if latest_version.status not in {DocumentStatus.PENDENTE_COORDENACAO, DocumentStatus.EM_REVISAO}:
            raise ConflictServiceError(
                "Only versions pending coordinator approval can be approved."
            )

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

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to reject.")

        try:
            if latest_version.status in {DocumentStatus.RASCUNHO, DocumentStatus.REVISAR_RASCUNHO}:
                if not current_user.has_role(UserRole.REVISOR):
                    raise ForbiddenServiceError("Only reviewer role can reject drafts.")
                latest_version.status = DocumentStatus.REVISAR_RASCUNHO
            elif latest_version.status in {DocumentStatus.PENDENTE_COORDENACAO, DocumentStatus.EM_REVISAO}:
                self._ensure_can_approve(current_user, document_id=document_id)
                latest_version.status = DocumentStatus.REPROVADO
            else:
                raise ConflictServiceError("Only draft or pending coordinator versions can be rejected.")

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
                message=f"Document rejected successfully. Reason: {reason.strip()}"
            )

        return MessageResponse(message="Document rejected successfully.")

    @staticmethod
    def _ensure_authenticated_user_id(current_user: AuthenticatedUser) -> None:
        if current_user.user_id is None:
            raise ForbiddenServiceError("Authenticated user must include a valid user id.")

    @staticmethod
    def _ensure_can_write(current_user: AuthenticatedUser) -> None:
        if not current_user.has_any_role({UserRole.AUTOR, UserRole.REVISOR, UserRole.COORDENADOR}):
            raise ForbiddenServiceError("Only author, reviewer, or coordinator can modify documents.")

    @staticmethod
    def _ensure_can_submit_for_review(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.REVISOR):
            raise ForbiddenServiceError("Only reviewer role can submit documents for review.")

    def _ensure_can_approve(self, current_user: AuthenticatedUser, *, document_id: int) -> None:
        if not current_user.has_role(UserRole.COORDENADOR):
            raise ForbiddenServiceError("Only coordinator role can approve documents.")

        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        user = self.auth_repository.get_user_by_id(current_user.user_id)
        if user is None:
            raise ForbiddenServiceError("Authenticated coordinator was not found in database.")

        user_sector_ids: list[int] = []
        for sector_id in (getattr(user, "sector_ids", None) or []):
            if isinstance(sector_id, int) and sector_id not in user_sector_ids:
                user_sector_ids.append(sector_id)
        if user.sector_id is not None and user.sector_id not in user_sector_ids:
            user_sector_ids.append(user.sector_id)

        # Only enforce sector matching when both sides are explicitly configured.
        if user_sector_ids and document.sector_id not in user_sector_ids:
            raise ForbiddenServiceError("Coordinator can only approve documents from the same sector.")

    def _get_editable_draft(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
    ):
        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        if document.created_by != current_user.user_id:
            raise ForbiddenServiceError("Only the requester can edit or delete this draft.")

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions.")

        if latest_version.status not in {DocumentStatus.RASCUNHO, DocumentStatus.REVISAR_RASCUNHO}:
            raise ConflictServiceError("Only draft documents can be edited or deleted.")

        return document, latest_version

    def _attach_uploaded_file_to_version(self, *, file_path: str, document_id: int, version_id: int) -> None:
        if self.file_repository is None:
            return
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

    @staticmethod
    def _build_document_code(*, document_type: str, document_id: int, sector_sigla: str | None) -> str:
        normalized_type = DocumentService._slug_segment(document_type) or "DOC"
        normalized_sector = DocumentService._slug_segment(sector_sigla or "") or "SET"
        return f"{normalized_type}-{normalized_sector}-{document_id}"

    @staticmethod
    def _slug_segment(value: str) -> str:
        stripped = unicodedata.normalize("NFKD", value or "")
        ascii_only = stripped.encode("ascii", "ignore").decode("ascii")
        clean = re.sub(r"[^A-Za-z0-9]+", "", ascii_only)
        return clean.upper()
