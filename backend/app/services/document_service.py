from datetime import UTC, datetime
import re
import unicodedata

from sqlalchemy.exc import SQLAlchemyError

from app.core.audit import AuditContext
from app.core.enums import DocumentEventType, DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.stored_file_repository import StoredFileRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.audit import AuditLogListResponse
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate, DocumentDraftUpdate, DocumentFormOptionsRead
from app.schemas.workflow import WorkflowDocumentListResponse, WorkflowDocumentRead, WorkflowVersionRead
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

    def create_document(
        self,
        payload: DocumentCreate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_create_document(current_user, payload.scope)

        company = self.repository.get_company_by_id(payload.company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        selected_sector_id = payload.sector_id
        if payload.scope == DocumentScope.CORPORATIVO and selected_sector_id is None:
            selected_sector_id = self._resolve_company_sector_fallback(payload.company_id)

        if selected_sector_id is None:
            if payload.scope == DocumentScope.CORPORATIVO:
                raise ConflictServiceError("Selected company must have at least one sector configured.")
            raise ConflictServiceError("Sector is required for local documents.")

        sector = self.repository.get_sector_by_id(selected_sector_id)
        if sector is None:
            raise NotFoundServiceError("Sector not found.")

        if sector.company_id != company.id:
            raise ConflictServiceError("Selected sector does not belong to selected company.")

        if payload.scope == DocumentScope.LOCAL and not self._can_access_company_and_sector(
            current_user, company.id, sector.id
        ):
            raise ForbiddenServiceError(
                "You do not have permission for the selected company and sector."
            )

        normalized_payload = payload
        if selected_sector_id != payload.sector_id:
            normalized_payload = payload.model_copy(update={"sector_id": selected_sector_id})

        try:
            document = self.repository.create_document(
                payload=normalized_payload,
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
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document",
                entity_id=document.id,
                action="CREATE",
                document_id=document.id,
                context=audit_context,
                entity_label=self._document_entity_label(document),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "code",
                        "field_label": "Codigo",
                        "old_value": None,
                        "new_value": document.code,
                        "old_display_value": None,
                        "new_display_value": document.code,
                    },
                    {
                        "field_name": "title",
                        "field_label": "Titulo",
                        "old_value": None,
                        "new_value": payload.title,
                        "old_display_value": None,
                        "new_display_value": payload.title,
                    },
                    {
                        "field_name": "company_id",
                        "field_label": "Empresa",
                        "old_value": None,
                        "new_value": normalized_payload.company_id,
                        "old_display_value": None,
                        "new_display_value": getattr(company, "name", None)
                        or f"Empresa #{normalized_payload.company_id}",
                    },
                    {
                        "field_name": "sector_id",
                        "field_label": "Setor",
                        "old_value": None,
                        "new_value": normalized_payload.sector_id,
                        "old_display_value": None,
                        "new_display_value": getattr(sector, "name", None)
                        or f"Setor #{normalized_payload.sector_id}",
                    },
                    {
                        "field_name": "document_type",
                        "field_label": "Tipo documental",
                        "old_value": None,
                        "new_value": payload.document_type,
                        "old_display_value": None,
                        "new_display_value": self._resolve_document_type_display(payload.document_type),
                    },
                    {
                        "field_name": "scope",
                        "field_label": "Escopo",
                        "old_value": None,
                        "new_value": payload.scope.value if payload.scope else None,
                        "old_display_value": None,
                        "new_display_value": payload.scope.value if payload.scope else None,
                    },
                ],
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_version",
                entity_id=initial_version.id,
                action="CREATE",
                document_id=document.id,
                version_id=initial_version.id,
                context=audit_context,
                entity_label=self._version_entity_label(document, initial_version.id, 1),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "version_number",
                        "field_label": "Versao",
                        "old_value": None,
                        "new_value": 1,
                        "old_display_value": None,
                        "new_display_value": "1",
                    },
                    {
                        "field_name": "status",
                        "field_label": "Status",
                        "old_value": None,
                        "new_value": DocumentStatus.RASCUNHO.value,
                        "old_display_value": None,
                        "new_display_value": self._status_label(DocumentStatus.RASCUNHO.value),
                    },
                    {
                        "field_name": "file_path",
                        "field_label": "Arquivo",
                        "old_value": None,
                        "new_value": payload.file_path,
                        "old_display_value": None,
                        "new_display_value": payload.file_path,
                    },
                    {
                        "field_name": "expiration_date",
                        "field_label": "Data de vencimento",
                        "old_value": None,
                        "new_value": payload.expiration_date,
                        "old_display_value": None,
                        "new_display_value": payload.expiration_date,
                    },
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create document with the provided data.") from exc

        return MessageResponse(message="Novo documento criado com sucesso!")

    def get_form_options(self, current_user: AuthenticatedUser) -> DocumentFormOptionsRead:
        companies = self.repository.list_companies()
        sectors = self.repository.list_sectors()
        if not current_user.has_role(UserRole.ADMIN):
            allowed_sector_ids = set(current_user.normalized_sector_ids())
            sectors = [
                sector for sector in sectors if isinstance(getattr(sector, "id", None), int) and sector.id in allowed_sector_ids
            ]
            visible_company_ids = {int(getattr(sector, "company_id")) for sector in sectors}
            user_company_ids = set(current_user.normalized_company_ids())
            if user_company_ids:
                visible_company_ids.update(user_company_ids)
            if visible_company_ids:
                companies = [
                    company
                    for company in companies
                    if isinstance(getattr(company, "id", None), int) and company.id in visible_company_ids
                ]

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

    def list_documents(self, current_user: AuthenticatedUser) -> list[Document]:
        self._ensure_can_access_document_registry(current_user)
        documents = self.repository.list_documents()
        return [document for document in documents if self._can_access_document(current_user, document)]

    def get_document(self, document_id: int, current_user: AuthenticatedUser) -> Document | None:
        self._ensure_can_access_document_registry(current_user)
        document = self.repository.get_document_by_id(document_id)
        if document is None:
            return None
        if not self._can_access_document(current_user, document):
            raise ForbiddenServiceError("You do not have permission to access this document.")
        return document

    def list_workflow_documents(
        self,
        current_user: AuthenticatedUser,
        *,
        term: str | None = None,
        company_id: int | None = None,
        sector_id: int | None = None,
        document_type: str | None = None,
        scope: DocumentScope | None = None,
        latest_status: DocumentStatus | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> WorkflowDocumentListResponse:
        self._ensure_can_access_document_registry(current_user)

        normalized_page = max(1, int(page))
        normalized_page_size = min(500, max(1, int(page_size)))
        normalized_term = (term or "").strip().lower()
        normalized_document_type = (document_type or "").strip().upper()

        documents = self.repository.list_documents_with_versions()

        filtered_documents: list[Document] = []
        for document in documents:
            if not self._can_access_document(current_user, document):
                continue
            if company_id is not None and document.company_id != company_id:
                continue
            if sector_id is not None and document.sector_id != sector_id:
                continue
            if normalized_document_type and (document.document_type or "").strip().upper() != normalized_document_type:
                continue
            if scope is not None and document.scope != scope:
                continue

            ordered_versions = self._ordered_versions(document)
            latest_version = ordered_versions[0] if ordered_versions else None

            if latest_status is not None:
                if latest_version is None or latest_version.status != latest_status:
                    continue

            if normalized_term:
                haystack = " ".join(
                    [
                        document.code or "",
                        document.title or "",
                        document.document_type or "",
                        document.scope.value if isinstance(document.scope, DocumentScope) else str(document.scope or ""),
                        getattr(document.company, "name", "") or "",
                        getattr(document.sector, "name", "") or "",
                        latest_version.status.value if latest_version is not None else "",
                    ]
                ).lower()
                if normalized_term not in haystack:
                    continue

            filtered_documents.append(document)

        total = len(filtered_documents)
        start = (normalized_page - 1) * normalized_page_size
        end = start + normalized_page_size
        paged_documents = filtered_documents[start:end]

        items: list[WorkflowDocumentRead] = []
        for document in paged_documents:
            ordered_versions = self._ordered_versions(document)
            versions = [
                WorkflowVersionRead.model_validate(version)
                for version in ordered_versions
            ]
            latest_status_value = ordered_versions[0].status if ordered_versions else None

            items.append(
                WorkflowDocumentRead(
                    id=document.id,
                    code=document.code,
                    title=document.title,
                    company_id=document.company_id,
                    company_name=getattr(document.company, "name", None),
                    sector_id=document.sector_id,
                    sector_name=getattr(document.sector, "name", None),
                    document_type=document.document_type,
                    adjustment_comment=getattr(document, "adjustment_comment", None),
                    adjustment_comment_by_name=self._resolve_user_name(
                        getattr(document, "adjustment_comment_by", None)
                    ),
                    adjustment_reply_comment=getattr(document, "adjustment_reply_comment", None),
                    adjustment_reply_comment_by_name=self._resolve_user_name(
                        getattr(document, "adjustment_reply_comment_by", None)
                    ),
                    scope=document.scope,
                    created_by=document.created_by,
                    created_by_name=document.created_by_name,
                    created_at=document.created_at,
                    latest_status=latest_status_value,
                    versions=versions,
                )
            )

        return WorkflowDocumentListResponse(
            items=items,
            total=total,
            page=normalized_page,
            page_size=normalized_page_size,
        )

    def list_document_events(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
        *,
        term: str | None = None,
        action: str | None = None,
        user_id: int | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> AuditLogListResponse:
        self._ensure_can_access_document_registry(current_user)
        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")
        if not self._can_access_document(current_user, document):
            raise ForbiddenServiceError("You do not have permission to access this document.")
        return self.audit_service.list_document_logs(
            document_id=document_id,
            term=term,
            action=action,
            user_id=user_id,
            page=page,
            page_size=page_size,
        )

    def update_draft_document(
        self,
        document_id: int,
        payload: DocumentDraftUpdate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        document, latest_version = self._get_editable_draft(document_id, current_user)
        original_title = document.title
        original_code = document.code
        original_company_id = document.company_id
        original_sector_id = document.sector_id
        original_document_type = document.document_type
        original_scope = document.scope
        original_adjustment_reply_comment = getattr(document, "adjustment_reply_comment", None)
        original_file_path = latest_version.file_path
        original_expiration_date = latest_version.expiration_date
        original_status = latest_version.status

        document_changed = False
        version_changed = False
        selected_company = None
        selected_sector = None

        if payload.title is not None:
            title = payload.title.strip()
            if not title:
                raise ConflictServiceError("Title cannot be empty.")
            if document.title != title:
                document.title = title
                document_changed = True

        if payload.company_id is not None:
            selected_company = self.repository.get_company_by_id(payload.company_id)
            if selected_company is None:
                raise NotFoundServiceError("Company not found.")
            if document.company_id != payload.company_id:
                document.company_id = payload.company_id
                document_changed = True

        if payload.sector_id is not None:
            selected_sector = self.repository.get_sector_by_id(payload.sector_id)
            if selected_sector is None:
                raise NotFoundServiceError("Sector not found.")
            if document.sector_id != payload.sector_id:
                document.sector_id = payload.sector_id
                document_changed = True

        if payload.document_type is not None:
            document_type = payload.document_type.strip().upper()
            if not document_type:
                raise ConflictServiceError("Document type cannot be empty.")
            if document.document_type != document_type:
                document.document_type = document_type
                document_changed = True

        if payload.scope is not None and document.scope != payload.scope:
            document.scope = payload.scope
            document_changed = True

        if payload.adjustment_reply_comment is not None:
            normalized_adjustment_reply_comment = (
                payload.adjustment_reply_comment.strip() if payload.adjustment_reply_comment.strip() else None
            )
            if getattr(document, "adjustment_reply_comment", None) != normalized_adjustment_reply_comment:
                document.adjustment_reply_comment = normalized_adjustment_reply_comment
                document.adjustment_reply_comment_by = current_user.user_id if normalized_adjustment_reply_comment else None
                document_changed = True

        if selected_company is None and (payload.company_id is not None or payload.sector_id is not None):
            selected_company = self.repository.get_company_by_id(document.company_id)
        if selected_sector is None and (payload.company_id is not None or payload.sector_id is not None):
            selected_sector = self.repository.get_sector_by_id(document.sector_id)

        if selected_company is not None and selected_sector is not None:
            if selected_sector.company_id != selected_company.id:
                raise ConflictServiceError("Selected sector does not belong to selected company.")
            if not self._can_access_company_and_sector(current_user, selected_company.id, selected_sector.id):
                raise ForbiddenServiceError(
                    "You do not have permission for the selected company and sector."
                )

        if document.document_type != original_document_type or document.sector_id != original_sector_id:
            if selected_sector is None:
                selected_sector = self.repository.get_sector_by_id(document.sector_id)
            if selected_sector is None:
                raise NotFoundServiceError("Sector not found.")
            next_code = self._build_document_code(
                document_type=document.document_type,
                document_id=document.id,
                sector_sigla=getattr(selected_sector, "sigla", None),
            )
            if document.code != next_code:
                document.code = next_code
                document_changed = True

        if payload.file_path is not None:
            file_path = payload.file_path.strip()
            if not file_path:
                raise ConflictServiceError("File path cannot be empty.")
            if latest_version.file_path != file_path:
                latest_version.file_path = file_path
                version_changed = True

        if payload.expiration_date is not None and latest_version.expiration_date != payload.expiration_date:
            latest_version.expiration_date = payload.expiration_date
            version_changed = True

        if original_status == DocumentStatus.REVISAR_RASCUNHO:
            latest_version.status = DocumentStatus.RASCUNHO_REVISADO
            version_changed = True

        if not document_changed and not version_changed:
            raise ConflictServiceError("Provide at least one field to update.")

        try:
            if document_changed:
                self.repository.save(document)
            if version_changed:
                self.version_repository.save(latest_version)

            document_changes = []
            if original_title != document.title:
                document_changes.append(
                    {
                        "field_name": "title",
                        "field_label": "Titulo",
                        "old_value": original_title,
                        "new_value": document.title,
                        "old_display_value": original_title,
                        "new_display_value": document.title,
                    }
                )
            if original_company_id != document.company_id:
                old_company = self.repository.get_company_by_id(original_company_id) if original_company_id else None
                new_company = selected_company or self.repository.get_company_by_id(document.company_id)
                document_changes.append(
                    {
                        "field_name": "company_id",
                        "field_label": "Empresa",
                        "old_value": original_company_id,
                        "new_value": document.company_id,
                        "old_display_value": getattr(old_company, "name", None) or f"Empresa #{original_company_id}",
                        "new_display_value": getattr(new_company, "name", None) or f"Empresa #{document.company_id}",
                    }
                )
            if original_sector_id != document.sector_id:
                old_sector = self.repository.get_sector_by_id(original_sector_id) if original_sector_id else None
                new_sector = selected_sector or self.repository.get_sector_by_id(document.sector_id)
                document_changes.append(
                    {
                        "field_name": "sector_id",
                        "field_label": "Setor",
                        "old_value": original_sector_id,
                        "new_value": document.sector_id,
                        "old_display_value": getattr(old_sector, "name", None) or f"Setor #{original_sector_id}",
                        "new_display_value": getattr(new_sector, "name", None) or f"Setor #{document.sector_id}",
                    }
                )
            if original_document_type != document.document_type:
                document_changes.append(
                    {
                        "field_name": "document_type",
                        "field_label": "Tipo documental",
                        "old_value": original_document_type,
                        "new_value": document.document_type,
                        "old_display_value": self._resolve_document_type_display(original_document_type),
                        "new_display_value": self._resolve_document_type_display(document.document_type),
                    }
                )
            if original_scope != document.scope:
                document_changes.append(
                    {
                        "field_name": "scope",
                        "field_label": "Escopo",
                        "old_value": original_scope.value if original_scope else None,
                        "new_value": document.scope.value if document.scope else None,
                        "old_display_value": original_scope.value if original_scope else None,
                        "new_display_value": document.scope.value if document.scope else None,
                    }
                )
            if original_adjustment_reply_comment != document.adjustment_reply_comment:
                document_changes.append(
                    {
                        "field_name": "adjustment_reply_comment",
                        "field_label": "Comentario de reajuste",
                        "old_value": original_adjustment_reply_comment,
                        "new_value": document.adjustment_reply_comment,
                        "old_display_value": original_adjustment_reply_comment,
                        "new_display_value": document.adjustment_reply_comment,
                    }
                )
            if original_code != document.code:
                document_changes.append(
                    {
                        "field_name": "code",
                        "field_label": "Codigo",
                        "old_value": original_code,
                        "new_value": document.code,
                        "old_display_value": original_code,
                        "new_display_value": document.code,
                    }
                )

            if document_changes:
                self.audit_service.create_field_change_logs(
                    user_id=current_user.user_id,
                    entity_type="document",
                    entity_id=document.id,
                    action="UPDATE",
                    document_id=document.id,
                    context=audit_context,
                    entity_label=self._document_entity_label(document),
                    actor_name=self._actor_snapshot(current_user),
                    changes=document_changes,
                )

            version_changes = []
            if original_file_path != latest_version.file_path:
                version_changes.append(
                    {
                        "field_name": "file_path",
                        "field_label": "Arquivo",
                        "old_value": original_file_path,
                        "new_value": latest_version.file_path,
                        "old_display_value": original_file_path,
                        "new_display_value": latest_version.file_path,
                    }
                )
            if original_expiration_date != latest_version.expiration_date:
                version_changes.append(
                    {
                        "field_name": "expiration_date",
                        "field_label": "Data de vencimento",
                        "old_value": original_expiration_date,
                        "new_value": latest_version.expiration_date,
                        "old_display_value": original_expiration_date,
                        "new_display_value": latest_version.expiration_date,
                    }
                )
            if original_status != latest_version.status:
                version_changes.append(
                    {
                        "field_name": "status",
                        "field_label": "Status",
                        "old_value": original_status.value if original_status else None,
                        "new_value": latest_version.status.value if latest_version.status else None,
                        "old_display_value": self._status_label(original_status.value if original_status else None),
                        "new_display_value": self._status_label(latest_version.status.value if latest_version.status else None),
                    }
                )

            if version_changes:
                self.audit_service.create_field_change_logs(
                    user_id=current_user.user_id,
                    entity_type="document_version",
                    entity_id=latest_version.id,
                    action="UPDATE",
                    document_id=document.id,
                    version_id=latest_version.id,
                    context=audit_context,
                    entity_label=self._version_entity_label(
                        document,
                        latest_version.id,
                        getattr(latest_version, "version_number", None),
                    ),
                    actor_name=self._actor_snapshot(current_user),
                    changes=version_changes,
                )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update draft document.") from exc

        return MessageResponse(message="Draft document updated successfully.")

    def delete_draft_document(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        document, latest_version = self._get_editable_draft(document_id, current_user)

        try:
            self.audit_service.create_action_log(
                user_id=current_user.user_id,
                entity_type="document",
                entity_id=document.id,
                action="DELETE",
                field_name="record",
                field_label="Registro",
                old_value={
                    "code": getattr(document, "code", None),
                    "title": getattr(document, "title", None),
                    "company_id": getattr(document, "company_id", None),
                    "sector_id": getattr(document, "sector_id", None),
                    "document_type": getattr(document, "document_type", None),
                    "latest_version_id": latest_version.id,
                    "latest_status": latest_version.status.value if latest_version.status else None,
                },
                new_value=None,
                old_display_value=f"{getattr(document, 'title', '')} ({getattr(document, 'code', '')})".strip(),
                new_display_value=None,
                document_id=document.id,
                version_id=latest_version.id,
                context=audit_context,
                entity_label=self._document_entity_label(document),
                actor_name=self._actor_snapshot(current_user),
            )
            self.repository.delete(document)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete draft document.") from exc

        return MessageResponse(message="Draft document deleted successfully.")

    def submit_for_review(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        self._ensure_can_submit_for_review(current_user)

        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to submit.")

        if latest_version.status not in {
            DocumentStatus.RASCUNHO,
            DocumentStatus.REVISAR_RASCUNHO,
            DocumentStatus.RASCUNHO_REVISADO,
        }:
            raise ConflictServiceError(
                "Only draft versions can be sent to pending adjustment."
            )

        try:
            previous_status = latest_version.status
            latest_version.status = DocumentStatus.REVISAR_RASCUNHO
            latest_version.invalidated_at = None
            latest_version.invalidated_by = None
            self.version_repository.save(latest_version)
            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.SUBMITTED_FOR_REVIEW,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_version",
                entity_id=latest_version.id,
                action="STATUS_CHANGE",
                document_id=document_id,
                version_id=latest_version.id,
                context=audit_context,
                entity_label=self._version_entity_label(
                    document,
                    latest_version.id,
                    getattr(latest_version, "version_number", None),
                ),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "status",
                        "field_label": "Status",
                        "old_value": previous_status.value if previous_status else None,
                        "new_value": DocumentStatus.REVISAR_RASCUNHO.value,
                        "old_display_value": self._status_label(previous_status.value if previous_status else None),
                        "new_display_value": self._status_label(DocumentStatus.REVISAR_RASCUNHO.value),
                    }
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not move document to pending adjustment.") from exc

        return MessageResponse(message="Document moved to pending adjustment queue.")

    def approve_document(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)
        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to approve.")
        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        self._ensure_can_approve(current_user, document_id=document_id, latest_status=latest_version.status)

        approvable_statuses = {
            DocumentStatus.RASCUNHO,
            DocumentStatus.RASCUNHO_REVISADO,
            DocumentStatus.REVISAR_RASCUNHO,
            DocumentStatus.PENDENTE_COORDENACAO,
            DocumentStatus.EM_REVISAO,
        }

        if latest_version.status not in approvable_statuses:
            raise ConflictServiceError("Only draft and reviewed versions can be approved.")

        active_version = self.version_repository.get_active_version_for_document(document_id)

        try:
            approval_time = datetime.now(UTC)
            if active_version is not None and active_version.id != latest_version.id:
                previous_active_status = active_version.status
                active_version.status = DocumentStatus.OBSOLETO
                active_version.invalidated_at = approval_time
                active_version.invalidated_by = current_user.user_id
                self.version_repository.save(active_version)
                self.audit_service.create_placeholder_event(
                    event_type=DocumentEventType.MARKED_OBSOLETE,
                    document_id=document_id,
                    version_id=active_version.id,
                    user_id=current_user.user_id,
                )
                self.audit_service.create_field_change_logs(
                    user_id=current_user.user_id,
                    entity_type="document_version",
                    entity_id=active_version.id,
                    action="STATUS_CHANGE",
                    document_id=document_id,
                    version_id=active_version.id,
                    context=audit_context,
                    entity_label=self._version_entity_label(
                        document,
                        active_version.id,
                        getattr(active_version, "version_number", None),
                    ),
                    actor_name=self._actor_snapshot(current_user),
                    changes=[
                        {
                            "field_name": "status",
                            "field_label": "Status",
                            "old_value": previous_active_status.value if previous_active_status else None,
                            "new_value": DocumentStatus.OBSOLETO.value,
                            "old_display_value": self._status_label(previous_active_status.value if previous_active_status else None),
                            "new_display_value": self._status_label(DocumentStatus.OBSOLETO.value),
                        },
                        {
                            "field_name": "invalidated_by",
                            "field_label": "Invalidado por",
                            "old_value": None,
                            "new_value": current_user.user_id,
                            "old_display_value": None,
                            "new_display_value": self._resolve_user_name(current_user.user_id),
                        },
                        {
                            "field_name": "invalidated_at",
                            "field_label": "Invalidado em",
                            "old_value": None,
                            "new_value": approval_time,
                            "old_display_value": None,
                            "new_display_value": approval_time,
                        },
                    ],
                )

            previous_status = latest_version.status
            latest_version.status = DocumentStatus.VIGENTE
            latest_version.approved_by = current_user.user_id
            latest_version.approved_at = approval_time
            latest_version.invalidated_at = None
            latest_version.invalidated_by = None
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
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_version",
                entity_id=latest_version.id,
                action="STATUS_CHANGE",
                document_id=document_id,
                version_id=latest_version.id,
                context=audit_context,
                entity_label=self._version_entity_label(
                    document,
                    latest_version.id,
                    getattr(latest_version, "version_number", None),
                ),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "status",
                        "field_label": "Status",
                        "old_value": previous_status.value if previous_status else None,
                        "new_value": DocumentStatus.VIGENTE.value,
                        "old_display_value": self._status_label(previous_status.value if previous_status else None),
                        "new_display_value": self._status_label(DocumentStatus.VIGENTE.value),
                    },
                    {
                        "field_name": "approved_by",
                        "field_label": "Aprovado por",
                        "old_value": None,
                        "new_value": current_user.user_id,
                        "old_display_value": None,
                        "new_display_value": self._resolve_user_name(current_user.user_id),
                    },
                    {
                        "field_name": "approved_at",
                        "field_label": "Aprovado em",
                        "old_value": None,
                        "new_value": approval_time,
                        "old_display_value": None,
                        "new_display_value": approval_time,
                    },
                ],
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
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to reject.")
        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        normalized_reason = reason.strip() if reason and reason.strip() else None

        try:
            previous_status = latest_version.status
            previous_adjustment_comment = getattr(document, "adjustment_comment", None)
            previous_adjustment_reply_comment = getattr(document, "adjustment_reply_comment", None)
            previous_adjustment_comment_by = getattr(document, "adjustment_comment_by", None)
            previous_adjustment_reply_comment_by = getattr(document, "adjustment_reply_comment_by", None)
            if latest_version.status in {
                DocumentStatus.RASCUNHO,
                DocumentStatus.RASCUNHO_REVISADO,
                DocumentStatus.REVISAR_RASCUNHO,
                DocumentStatus.PENDENTE_COORDENACAO,
                DocumentStatus.EM_REVISAO,
            }:
                self._ensure_can_coordinator_review(current_user, document_id=document_id)
                latest_version.status = DocumentStatus.REVISAR_RASCUNHO
                latest_version.invalidated_at = None
                latest_version.invalidated_by = None
            else:
                raise ConflictServiceError("Only versions under review can be sent back for adjustment.")

            latest_version.approved_by = None
            latest_version.approved_at = None
            self.version_repository.save(latest_version)
            document.adjustment_comment = normalized_reason
            document.adjustment_reply_comment = None
            document.adjustment_comment_by = current_user.user_id
            document.adjustment_reply_comment_by = None
            self.repository.save(document)

            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.REJECTED,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_version",
                entity_id=latest_version.id,
                action="STATUS_CHANGE",
                document_id=document_id,
                version_id=latest_version.id,
                context=audit_context,
                entity_label=self._version_entity_label(
                    document,
                    latest_version.id,
                    getattr(latest_version, "version_number", None),
                ),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "status",
                        "field_label": "Status",
                        "old_value": previous_status.value if previous_status else None,
                        "new_value": latest_version.status.value,
                        "old_display_value": self._status_label(previous_status.value if previous_status else None),
                        "new_display_value": self._status_label(latest_version.status.value),
                    }
                ],
            )
            comment_changes: list[dict[str, str | None]] = []
            if previous_adjustment_comment != document.adjustment_comment:
                comment_changes.append(
                    {
                        "field_name": "adjustment_comment",
                        "field_label": "Comentario de ajuste",
                        "old_value": previous_adjustment_comment,
                        "new_value": document.adjustment_comment,
                        "old_display_value": previous_adjustment_comment,
                        "new_display_value": document.adjustment_comment,
                    }
                )
            if previous_adjustment_comment_by != document.adjustment_comment_by:
                comment_changes.append(
                    {
                        "field_name": "adjustment_comment_by",
                        "field_label": "Autor do comentario de ajuste",
                        "old_value": previous_adjustment_comment_by,
                        "new_value": document.adjustment_comment_by,
                        "old_display_value": self._resolve_user_name(previous_adjustment_comment_by),
                        "new_display_value": self._resolve_user_name(document.adjustment_comment_by),
                    }
                )
            if previous_adjustment_reply_comment != document.adjustment_reply_comment:
                comment_changes.append(
                    {
                        "field_name": "adjustment_reply_comment",
                        "field_label": "Comentario de reajuste",
                        "old_value": previous_adjustment_reply_comment,
                        "new_value": document.adjustment_reply_comment,
                        "old_display_value": previous_adjustment_reply_comment,
                        "new_display_value": document.adjustment_reply_comment,
                    }
                )
            if previous_adjustment_reply_comment_by != document.adjustment_reply_comment_by:
                comment_changes.append(
                    {
                        "field_name": "adjustment_reply_comment_by",
                        "field_label": "Autor do comentario de reajuste",
                        "old_value": previous_adjustment_reply_comment_by,
                        "new_value": document.adjustment_reply_comment_by,
                        "old_display_value": self._resolve_user_name(previous_adjustment_reply_comment_by),
                        "new_display_value": self._resolve_user_name(document.adjustment_reply_comment_by),
                    }
                )
            if comment_changes:
                self.audit_service.create_field_change_logs(
                    user_id=current_user.user_id,
                    entity_type="document",
                    entity_id=document.id,
                    action="UPDATE",
                    document_id=document_id,
                    context=audit_context,
                    entity_label=self._document_entity_label(document),
                    actor_name=self._actor_snapshot(current_user),
                    changes=comment_changes,
                )
            if normalized_reason:
                self.audit_service.create_action_log(
                    user_id=current_user.user_id,
                    entity_type="document_version",
                    entity_id=latest_version.id,
                    action="REJECT_REASON",
                    field_name="reason",
                    field_label="Motivo",
                    old_value=None,
                    new_value=normalized_reason,
                    old_display_value=None,
                    new_display_value=normalized_reason,
                    document_id=document_id,
                    version_id=latest_version.id,
                    context=audit_context,
                    entity_label=self._version_entity_label(
                        document,
                        latest_version.id,
                        getattr(latest_version, "version_number", None),
                    ),
                    actor_name=self._actor_snapshot(current_user),
                )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not reject document version.") from exc

        if normalized_reason:
            return MessageResponse(
                message=f"Document returned for adjustment successfully. Reason: {normalized_reason}"
            )

        return MessageResponse(message="Document returned for adjustment successfully.")

    def reject_document_definitive(
        self,
        document_id: int,
        current_user: AuthenticatedUser,
        *,
        reason: str | None = None,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_authenticated_user_id(current_user)

        latest_version = self.version_repository.get_latest_version_for_document(document_id)
        if latest_version is None:
            raise NotFoundServiceError("Document has no versions to reject.")
        document = self.repository.get_document_by_id(document_id)
        if document is None:
            raise NotFoundServiceError("Document not found.")

        normalized_reason = reason.strip() if reason and reason.strip() else None

        try:
            previous_status = latest_version.status
            previous_adjustment_comment = getattr(document, "adjustment_comment", None)
            previous_adjustment_comment_by = getattr(document, "adjustment_comment_by", None)
            if latest_version.status in {
                DocumentStatus.RASCUNHO,
                DocumentStatus.RASCUNHO_REVISADO,
                DocumentStatus.REVISAR_RASCUNHO,
                DocumentStatus.PENDENTE_COORDENACAO,
                DocumentStatus.EM_REVISAO,
            }:
                self._ensure_can_coordinator_review(current_user, document_id=document_id)
                latest_version.status = DocumentStatus.REPROVADO
                latest_version.invalidated_at = None
                latest_version.invalidated_by = None
            else:
                raise ConflictServiceError("Only versions under review can be rejected definitively.")

            latest_version.approved_by = None
            latest_version.approved_at = None
            self.version_repository.save(latest_version)
            document.adjustment_comment = normalized_reason
            document.adjustment_comment_by = current_user.user_id
            self.repository.save(document)

            self.audit_service.create_placeholder_event(
                event_type=DocumentEventType.REJECTED,
                document_id=document_id,
                version_id=latest_version.id,
                user_id=current_user.user_id,
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_version",
                entity_id=latest_version.id,
                action="STATUS_CHANGE",
                document_id=document_id,
                version_id=latest_version.id,
                context=audit_context,
                entity_label=self._version_entity_label(
                    document,
                    latest_version.id,
                    getattr(latest_version, "version_number", None),
                ),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "status",
                        "field_label": "Status",
                        "old_value": previous_status.value if previous_status else None,
                        "new_value": latest_version.status.value,
                        "old_display_value": self._status_label(previous_status.value if previous_status else None),
                        "new_display_value": self._status_label(latest_version.status.value),
                    }
                ],
            )
            if previous_adjustment_comment != document.adjustment_comment:
                self.audit_service.create_field_change_logs(
                    user_id=current_user.user_id,
                    entity_type="document",
                    entity_id=document.id,
                    action="UPDATE",
                    document_id=document_id,
                    context=audit_context,
                    entity_label=self._document_entity_label(document),
                    actor_name=self._actor_snapshot(current_user),
                    changes=[
                        {
                            "field_name": "adjustment_comment",
                            "field_label": "Motivo da reprovacao definitiva",
                            "old_value": previous_adjustment_comment,
                            "new_value": document.adjustment_comment,
                            "old_display_value": previous_adjustment_comment,
                            "new_display_value": document.adjustment_comment,
                        }
                    ],
                )
            if previous_adjustment_comment_by != document.adjustment_comment_by:
                self.audit_service.create_field_change_logs(
                    user_id=current_user.user_id,
                    entity_type="document",
                    entity_id=document.id,
                    action="UPDATE",
                    document_id=document_id,
                    context=audit_context,
                    entity_label=self._document_entity_label(document),
                    actor_name=self._actor_snapshot(current_user),
                    changes=[
                        {
                            "field_name": "adjustment_comment_by",
                            "field_label": "Autor do motivo da reprovacao definitiva",
                            "old_value": previous_adjustment_comment_by,
                            "new_value": document.adjustment_comment_by,
                            "old_display_value": self._resolve_user_name(previous_adjustment_comment_by),
                            "new_display_value": self._resolve_user_name(document.adjustment_comment_by),
                        }
                    ],
                )
            if normalized_reason:
                self.audit_service.create_action_log(
                    user_id=current_user.user_id,
                    entity_type="document_version",
                    entity_id=latest_version.id,
                    action="REJECT_FINAL_REASON",
                    field_name="reason",
                    field_label="Motivo",
                    old_value=None,
                    new_value=normalized_reason,
                    old_display_value=None,
                    new_display_value=normalized_reason,
                    document_id=document_id,
                    version_id=latest_version.id,
                    context=audit_context,
                    entity_label=self._version_entity_label(
                        document,
                        latest_version.id,
                        getattr(latest_version, "version_number", None),
                    ),
                    actor_name=self._actor_snapshot(current_user),
                )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not reject document version definitively.") from exc

        if normalized_reason:
            return MessageResponse(
                message=f"Document rejected definitively. Reason: {normalized_reason}"
            )

        return MessageResponse(message="Document rejected definitively.")

    @staticmethod
    def _actor_snapshot(current_user: AuthenticatedUser) -> str | None:
        return current_user.username or current_user.email

    @staticmethod
    def _status_label(status_value: str | None) -> str | None:
        if not status_value:
            return None
        labels = {
            DocumentStatus.RASCUNHO.value: "Rascunho",
            DocumentStatus.RASCUNHO_REVISADO.value: "Rascunho revisado",
            DocumentStatus.REVISAR_RASCUNHO.value: "Pendente Ajuste",
            DocumentStatus.PENDENTE_COORDENACAO.value: "Pendente coordenacao",
            DocumentStatus.EM_REVISAO.value: "Em revisao",
            DocumentStatus.REPROVADO.value: "Reprovado",
            DocumentStatus.VIGENTE.value: "Vigente",
            DocumentStatus.OBSOLETO.value: "Obsoleto",
        }
        return labels.get(status_value, status_value)

    def _resolve_user_name(self, user_id: int | None) -> str | None:
        if user_id is None:
            return None
        user = self.auth_repository.get_user_by_id(user_id)
        if user is None:
            return f"Usuario #{user_id}"
        return getattr(user, "name", None) or getattr(user, "username", None) or f"Usuario #{user_id}"

    def _resolve_document_type_display(self, document_type_sigla: str | None) -> str | None:
        normalized = (document_type_sigla or "").strip().upper()
        if not normalized:
            return None
        document_types = self.repository.list_document_types()
        if not isinstance(document_types, list):
            return normalized
        for item in document_types:
            sigla = str(getattr(item, "sigla", "") or "").strip().upper()
            if sigla != normalized:
                continue
            name = str(getattr(item, "name", "") or "").strip()
            if not name:
                return sigla
            return f"{name} ({sigla})"
        return normalized

    @staticmethod
    def _document_entity_label(document: Document) -> str:
        title = (getattr(document, "title", None) or "").strip()
        code = (getattr(document, "code", None) or "").strip()
        if title and code:
            return f"Documento #{document.id} ({title} - {code})"
        if title:
            return f"Documento #{document.id} ({title})"
        if code:
            return f"Documento #{document.id} ({code})"
        return f"Documento #{document.id}"

    @staticmethod
    def _version_entity_label(document: Document, version_id: int, version_number: int | None) -> str:
        title = (getattr(document, "title", None) or "").strip()
        code = (getattr(document, "code", None) or "").strip()
        version_label = f"v{version_number}" if version_number is not None else f"#{version_id}"
        if title and code:
            return f"Versao {version_label} de Documento #{document.id} ({title} - {code})"
        if title:
            return f"Versao {version_label} de Documento #{document.id} ({title})"
        return f"Versao {version_label} de Documento #{document.id}"

    @staticmethod
    def _ensure_authenticated_user_id(current_user: AuthenticatedUser) -> None:
        if current_user.user_id is None:
            raise ForbiddenServiceError("Authenticated user must include a valid user id.")

    @staticmethod
    def _ensure_can_write(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.AUTOR):
            raise ForbiddenServiceError("Only author role can modify documents.")

    @staticmethod
    def _ensure_can_create_document(current_user: AuthenticatedUser, scope: DocumentScope) -> None:
        if not current_user.has_role(UserRole.AUTOR):
            if scope == DocumentScope.CORPORATIVO:
                raise ForbiddenServiceError("Only author role can create corporate documents.")
            raise ForbiddenServiceError("Only author role can create local documents.")

    @staticmethod
    def _ensure_can_submit_for_review(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.COORDENADOR):
            raise ForbiddenServiceError("Only coordinator role can request adjustments.")

    @staticmethod
    def _ensure_can_access_document_registry(current_user: AuthenticatedUser) -> None:
        if not current_user.has_any_role({UserRole.AUTOR, UserRole.COORDENADOR}):
            raise ForbiddenServiceError("Only non-reader roles can access document registry endpoints.")

    @staticmethod
    def _can_access_document(current_user: AuthenticatedUser, document: Document) -> bool:
        if document.scope == DocumentScope.LOCAL:
            user_sector_ids = current_user.normalized_sector_ids()
            return bool(user_sector_ids) and getattr(document, "sector_id", None) in user_sector_ids
        if document.scope == DocumentScope.CORPORATIVO:
            return True
        return False

    @staticmethod
    def _can_access_company_and_sector(
        current_user: AuthenticatedUser,
        company_id: int | None,
        sector_id: int | None,
    ) -> bool:
        if current_user.has_role(UserRole.ADMIN):
            return True
        user_company_ids = current_user.normalized_company_ids()
        user_sector_ids = current_user.normalized_sector_ids()
        company_allowed = not user_company_ids or (company_id in user_company_ids)
        sector_allowed = not user_sector_ids or (sector_id in user_sector_ids)
        return company_allowed and sector_allowed

    def _resolve_company_sector_fallback(self, company_id: int) -> int | None:
        sectors = self.repository.list_sectors()
        for sector in sectors:
            sector_company_id = getattr(sector, "company_id", None)
            sector_id = getattr(sector, "id", None)
            if sector_company_id == company_id and isinstance(sector_id, int):
                return sector_id
        return None

    @staticmethod
    def _ordered_versions(document: Document):
        versions = getattr(document, "versions", None) or []
        return sorted(versions, key=lambda version: int(version.version_number or 0), reverse=True)

    def _ensure_can_approve(
        self,
        current_user: AuthenticatedUser,
        *,
        document_id: int,
        latest_status: DocumentStatus,
    ) -> None:
        if latest_status in {
            DocumentStatus.RASCUNHO,
            DocumentStatus.RASCUNHO_REVISADO,
            DocumentStatus.REVISAR_RASCUNHO,
            DocumentStatus.PENDENTE_COORDENACAO,
            DocumentStatus.EM_REVISAO,
        }:
            self._ensure_can_coordinator_review(current_user, document_id=document_id)
            return

        raise ConflictServiceError("Current version status does not allow approval action.")

    def _ensure_can_coordinator_review(self, current_user: AuthenticatedUser, *, document_id: int) -> None:
        if not current_user.has_role(UserRole.COORDENADOR):
            raise ForbiddenServiceError("Only coordinator role can review drafts.")
        if current_user.has_role(UserRole.ADMIN):
            return

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

        if latest_version.status not in {
            DocumentStatus.RASCUNHO,
            DocumentStatus.REVISAR_RASCUNHO,
            DocumentStatus.RASCUNHO_REVISADO,
        }:
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
