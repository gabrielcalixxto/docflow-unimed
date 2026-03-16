import re
import unicodedata

from sqlalchemy.exc import SQLAlchemyError

from app.core.audit import AuditContext
from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.repositories.admin_catalog_repository import AdminCatalogRepository
from app.schemas.admin_catalog import (
    AdminCatalogOptionsRead,
    AdminCompanyCreate,
    AdminDocumentTypeCreate,
    AdminDocumentTypeUpdate,
    AdminSectorCreate,
    AdminSectorUpdate,
    AdminCompanyUpdate,
)
from app.schemas.common import MessageResponse
from app.services.audit_service import AuditService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class AdminCatalogService:
    _LOWERCASE_WORDS = {"de", "do", "da"}

    def __init__(self, repository: AdminCatalogRepository, audit_service: AuditService | None = None):
        self.repository = repository
        self.audit_service = audit_service or AuditService()

    def get_options(self, current_user: AuthenticatedUser) -> AdminCatalogOptionsRead:
        self._ensure_catalog_manager(current_user)
        return AdminCatalogOptionsRead(
            companies=self.repository.list_companies(),
            sectors=self.repository.list_sectors(),
            document_types=self.repository.list_document_types(),
        )

    def create_company(
        self,
        payload: AdminCompanyCreate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        normalized_name = self._normalize_company_name(payload.name)
        if self.repository.get_company_by_name(normalized_name) is not None:
            raise ConflictServiceError("Company already exists.")

        try:
            company = self.repository.create_company(normalized_name)
            company_name = getattr(company, "name", None) or normalized_name
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="company",
                entity_id=company.id,
                action="CREATE",
                context=audit_context,
                entity_label=self._company_entity_label(company.id, company_name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": None,
                        "new_value": normalized_name,
                        "old_display_value": None,
                        "new_display_value": normalized_name,
                    }
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create company with the provided data.") from exc

        return MessageResponse(message=f"Company created successfully (id={company.id}).")

    def delete_company(
        self,
        company_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        company = self.repository.get_company_by_id(company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        if self.repository.count_company_sectors(company_id) > 0:
            raise ConflictServiceError("Cannot delete company with linked sectors.")
        if self.repository.count_company_documents(company_id) > 0:
            raise ConflictServiceError("Cannot delete company with linked documents.")
        if self.repository.count_company_users(company_id) > 0:
            raise ConflictServiceError("Cannot delete company with linked users.")

        try:
            company_name = getattr(company, "name", None)
            self.audit_service.create_action_log(
                user_id=current_user.user_id,
                entity_type="company",
                entity_id=company.id,
                action="DELETE",
                field_name="record",
                old_value={"id": company.id, "name": getattr(company, "name", None)},
                new_value=None,
                context=audit_context,
                field_label="Registro",
                old_display_value=company_name,
                new_display_value=None,
                entity_label=self._company_entity_label(company.id, company_name),
                actor_name=self._actor_snapshot(current_user),
            )
            self.repository.delete_company(company)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete company.") from exc

        return MessageResponse(message="Company deleted successfully.")

    def update_company(
        self,
        company_id: int,
        payload: AdminCompanyUpdate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        company = self.repository.get_company_by_id(company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        normalized_name = self._normalize_company_name(payload.name)
        existing = self.repository.get_company_by_name(normalized_name)
        if existing is not None and existing.id != company.id:
            raise ConflictServiceError("Company already exists.")

        try:
            previous_name = company.name
            self.repository.update_company(company, name=normalized_name)
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="company",
                entity_id=company.id,
                action="UPDATE",
                context=audit_context,
                entity_label=self._company_entity_label(company.id, normalized_name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": previous_name,
                        "new_value": normalized_name,
                        "old_display_value": previous_name,
                        "new_display_value": normalized_name,
                    }
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update company with the provided data.") from exc

        return MessageResponse(message="Company updated successfully.")

    def create_sector(
        self,
        payload: AdminSectorCreate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        company = self.repository.get_company_by_id(payload.company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        normalized_name = self._normalize_sector_name(payload.name)
        normalized_sigla = self._normalize_sector_sigla(payload.sigla)
        if self.repository.get_sector_by_name_and_company(normalized_name, payload.company_id) is not None:
            raise ConflictServiceError("Sector already exists for this company.")
        if self.repository.get_sector_by_sigla_and_company(normalized_sigla, payload.company_id) is not None:
            raise ConflictServiceError("Sector acronym already exists for this company.")

        try:
            sector = self.repository.create_sector(
                name=normalized_name,
                sigla=normalized_sigla,
                company_id=payload.company_id,
            )
            sector_name = getattr(sector, "name", None) or normalized_name
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="sector",
                entity_id=sector.id,
                action="CREATE",
                context=audit_context,
                entity_label=self._sector_entity_label(sector.id, sector_name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": None,
                        "new_value": normalized_name,
                        "old_display_value": None,
                        "new_display_value": normalized_name,
                    },
                    {
                        "field_name": "sigla",
                        "field_label": "Sigla",
                        "old_value": None,
                        "new_value": normalized_sigla,
                        "old_display_value": None,
                        "new_display_value": normalized_sigla,
                    },
                    {
                        "field_name": "company_id",
                        "field_label": "Empresa",
                        "old_value": None,
                        "new_value": payload.company_id,
                        "old_display_value": None,
                        "new_display_value": getattr(company, "name", None) or f"Empresa #{payload.company_id}",
                    },
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create sector with the provided data.") from exc

        return MessageResponse(message=f"Sector created successfully (id={sector.id}, sigla={sector.sigla}).")

    def delete_sector(
        self,
        sector_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        sector = self.repository.get_sector_by_id(sector_id)
        if sector is None:
            raise NotFoundServiceError("Sector not found.")

        if self.repository.count_sector_users(sector_id) > 0:
            raise ConflictServiceError("Cannot delete sector with linked users.")
        if self.repository.count_sector_documents(sector_id) > 0:
            raise ConflictServiceError("Cannot delete sector with linked documents.")

        try:
            sector_name = getattr(sector, "name", None)
            self.audit_service.create_action_log(
                user_id=current_user.user_id,
                entity_type="sector",
                entity_id=sector.id,
                action="DELETE",
                field_name="record",
                old_value={
                    "id": sector.id,
                    "name": getattr(sector, "name", None),
                    "sigla": getattr(sector, "sigla", None),
                    "company_id": getattr(sector, "company_id", None),
                },
                new_value=None,
                context=audit_context,
                field_label="Registro",
                old_display_value=f"{sector_name or f'Setor #{sector.id}'} ({getattr(sector, 'sigla', '')})".strip(),
                new_display_value=None,
                entity_label=self._sector_entity_label(sector.id, sector_name),
                actor_name=self._actor_snapshot(current_user),
            )
            self.repository.delete_sector(sector)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete sector.") from exc

        return MessageResponse(message="Sector deleted successfully.")

    def update_sector(
        self,
        sector_id: int,
        payload: AdminSectorUpdate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        sector = self.repository.get_sector_by_id(sector_id)
        if sector is None:
            raise NotFoundServiceError("Sector not found.")

        company = self.repository.get_company_by_id(payload.company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        normalized_name = self._normalize_sector_name(payload.name)
        normalized_sigla = self._normalize_sector_sigla(payload.sigla)
        existing = self.repository.get_sector_by_name_and_company(normalized_name, payload.company_id)
        if existing is not None and existing.id != sector.id:
            raise ConflictServiceError("Sector already exists for this company.")
        existing_sigla = self.repository.get_sector_by_sigla_and_company(normalized_sigla, payload.company_id)
        if existing_sigla is not None and existing_sigla.id != sector.id:
            raise ConflictServiceError("Sector acronym already exists for this company.")

        previous_name = sector.name
        previous_sigla = sector.sigla
        previous_company_id = sector.company_id
        previous_company = self.repository.get_company_by_id(previous_company_id) if previous_company_id else None

        company_changed = previous_company_id != payload.company_id
        sigla_changed = (previous_sigla or "").upper() != normalized_sigla.upper()
        moved_documents = 0
        recoded_documents = 0

        try:
            self.repository.update_sector(
                sector,
                name=normalized_name,
                sigla=normalized_sigla,
                company_id=payload.company_id,
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="sector",
                entity_id=sector.id,
                action="UPDATE",
                context=audit_context,
                entity_label=self._sector_entity_label(sector.id, normalized_name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": previous_name,
                        "new_value": normalized_name,
                        "old_display_value": previous_name,
                        "new_display_value": normalized_name,
                    },
                    {
                        "field_name": "sigla",
                        "field_label": "Sigla",
                        "old_value": previous_sigla,
                        "new_value": normalized_sigla,
                        "old_display_value": previous_sigla,
                        "new_display_value": normalized_sigla,
                    },
                    {
                        "field_name": "company_id",
                        "field_label": "Empresa",
                        "old_value": previous_company_id,
                        "new_value": payload.company_id,
                        "old_display_value": getattr(previous_company, "name", None) if previous_company else None,
                        "new_display_value": getattr(company, "name", None) or f"Empresa #{payload.company_id}",
                    },
                ],
            )
            if company_changed:
                moved_documents = self.repository.remap_documents_company_for_sector(
                    sector_id=sector.id,
                    target_company_id=payload.company_id,
                )
                self.audit_service.create_action_log(
                    user_id=current_user.user_id,
                    entity_type="sector",
                    entity_id=sector.id,
                    action="BULK_SYNC",
                    field_name="moved_documents",
                    old_value=None,
                    new_value=moved_documents,
                    context=audit_context,
                    field_label="Documentos com empresa atualizada",
                    old_display_value=None,
                    new_display_value=str(moved_documents),
                    entity_label=self._sector_entity_label(sector.id, normalized_name),
                    actor_name=self._actor_snapshot(current_user),
                )
            if sigla_changed:
                recoded_documents = self._sync_document_codes_for_sector(sector.id)
                self.audit_service.create_action_log(
                    user_id=current_user.user_id,
                    entity_type="sector",
                    entity_id=sector.id,
                    action="BULK_SYNC",
                    field_name="updated_codes",
                    old_value=None,
                    new_value=recoded_documents,
                    context=audit_context,
                    field_label="Codigos de documentos atualizados",
                    old_display_value=None,
                    new_display_value=str(recoded_documents),
                    entity_label=self._sector_entity_label(sector.id, normalized_name),
                    actor_name=self._actor_snapshot(current_user),
                )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update sector with the provided data.") from exc

        if company_changed or sigla_changed:
            details: list[str] = []
            if company_changed:
                details.append(f"moved documents={moved_documents}")
            if sigla_changed:
                details.append(f"updated codes={recoded_documents}")
            return MessageResponse(
                message=(
                    "Sector updated successfully and linked documents were synchronized "
                    f"({', '.join(details)})."
                )
            )
        return MessageResponse(message="Sector updated successfully.")

    def create_document_type(
        self,
        payload: AdminDocumentTypeCreate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        normalized_sigla = self._normalize_document_type_sigla(payload.sigla)
        normalized_name = self._normalize_document_type_name(payload.name)
        if self.repository.get_document_type_by_sigla(normalized_sigla) is not None:
            raise ConflictServiceError("Document type acronym already exists.")
        if self.repository.get_document_type_by_name(normalized_name) is not None:
            raise ConflictServiceError("Document type already exists.")

        try:
            document_type = self.repository.create_document_type(
                sigla=normalized_sigla,
                name=normalized_name,
            )
            document_type_name = getattr(document_type, "name", None) or normalized_name
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_type",
                entity_id=document_type.id,
                action="CREATE",
                context=audit_context,
                entity_label=self._document_type_entity_label(document_type.id, document_type_name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "sigla",
                        "field_label": "Sigla",
                        "old_value": None,
                        "new_value": normalized_sigla,
                        "old_display_value": None,
                        "new_display_value": normalized_sigla,
                    },
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": None,
                        "new_value": normalized_name,
                        "old_display_value": None,
                        "new_display_value": normalized_name,
                    },
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create document type.") from exc

        return MessageResponse(
            message=f"Document type created successfully (id={document_type.id}, sigla={document_type.sigla})."
        )

    def delete_document_type(
        self,
        document_type_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        document_type = self.repository.get_document_type_by_id(document_type_id)
        if document_type is None:
            raise NotFoundServiceError("Document type not found.")

        try:
            document_type_name = getattr(document_type, "name", None)
            document_type_sigla = getattr(document_type, "sigla", None)
            self.audit_service.create_action_log(
                user_id=current_user.user_id,
                entity_type="document_type",
                entity_id=document_type.id,
                action="DELETE",
                field_name="record",
                old_value={
                    "id": document_type.id,
                    "sigla": getattr(document_type, "sigla", None),
                    "name": getattr(document_type, "name", None),
                },
                new_value=None,
                context=audit_context,
                field_label="Registro",
                old_display_value=f"{document_type_name or f'Tipo documental #{document_type.id}'} ({document_type_sigla or ''})".strip(),
                new_display_value=None,
                entity_label=self._document_type_entity_label(document_type.id, document_type_name),
                actor_name=self._actor_snapshot(current_user),
            )
            self.repository.delete_document_type(document_type)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete document type.") from exc

        return MessageResponse(message="Document type deleted successfully.")

    def update_document_type(
        self,
        document_type_id: int,
        payload: AdminDocumentTypeUpdate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_catalog_manager(current_user)
        document_type = self.repository.get_document_type_by_id(document_type_id)
        if document_type is None:
            raise NotFoundServiceError("Document type not found.")

        normalized_sigla = self._normalize_document_type_sigla(payload.sigla)
        normalized_name = self._normalize_document_type_name(payload.name)

        existing_sigla = self.repository.get_document_type_by_sigla(normalized_sigla)
        if existing_sigla is not None and existing_sigla.id != document_type.id:
            raise ConflictServiceError("Document type acronym already exists.")

        existing_name = self.repository.get_document_type_by_name(normalized_name)
        if existing_name is not None and existing_name.id != document_type.id:
            raise ConflictServiceError("Document type already exists.")

        source_values = {document_type.sigla, document_type.name}
        previous_sigla = document_type.sigla
        previous_name = document_type.name

        try:
            self.repository.update_document_type(
                document_type,
                sigla=normalized_sigla,
                name=normalized_name,
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="document_type",
                entity_id=document_type.id,
                action="UPDATE",
                context=audit_context,
                entity_label=self._document_type_entity_label(document_type.id, normalized_name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "sigla",
                        "field_label": "Sigla",
                        "old_value": previous_sigla,
                        "new_value": normalized_sigla,
                        "old_display_value": previous_sigla,
                        "new_display_value": normalized_sigla,
                    },
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": previous_name,
                        "new_value": normalized_name,
                        "old_display_value": previous_name,
                        "new_display_value": normalized_name,
                    },
                ],
            )
            self.repository.remap_documents_document_type(
                source_values=source_values,
                target_sigla=normalized_sigla,
            )
            recoded_documents = self._sync_document_codes_for_document_type(normalized_sigla)
            self.audit_service.create_action_log(
                user_id=current_user.user_id,
                entity_type="document_type",
                entity_id=document_type.id,
                action="BULK_SYNC",
                field_name="updated_codes",
                old_value=None,
                new_value=recoded_documents,
                context=audit_context,
                field_label="Codigos de documentos atualizados",
                old_display_value=None,
                new_display_value=str(recoded_documents),
                entity_label=self._document_type_entity_label(document_type.id, normalized_name),
                actor_name=self._actor_snapshot(current_user),
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update document type.") from exc

        return MessageResponse(
            message=(
                "Document type updated successfully and linked documents were synchronized "
                f"(updated codes={recoded_documents})."
            )
        )

    @staticmethod
    def _normalize_text(value: str, *, upper: bool = False) -> str:
        normalized = " ".join((value or "").strip().split())
        if upper:
            normalized = normalized.upper()
        if len(normalized) < 2:
            raise ConflictServiceError("Value must contain at least 2 non-space characters.")
        return normalized

    @classmethod
    def _normalize_sector_name(cls, value: str) -> str:
        return cls._normalize_title_words_with_exceptions(value)

    @classmethod
    def _normalize_sector_sigla(cls, value: str) -> str:
        return cls._normalize_sigla(value, field_name="Sector acronym")

    @classmethod
    def _normalize_company_name(cls, value: str) -> str:
        return cls._normalize_title_words_with_exceptions(value)

    @classmethod
    def _normalize_document_type_name(cls, value: str) -> str:
        return cls._normalize_title_words_with_exceptions(value)

    @classmethod
    def _normalize_document_type_sigla(cls, value: str) -> str:
        return cls._normalize_sigla(value, field_name="Acronym")

    @classmethod
    def _normalize_sigla(cls, value: str, *, field_name: str) -> str:
        normalized = cls._normalize_text(value, upper=True)
        ascii_only = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii")
        alphanumeric_only = re.sub(r"[^A-Za-z0-9]+", "", ascii_only).upper()
        if len(alphanumeric_only) < 2:
            raise ConflictServiceError(f"{field_name} must contain at least 2 alphanumeric characters.")
        return alphanumeric_only

    def _sync_document_codes_for_sector(self, sector_id: int) -> int:
        documents = self.repository.list_documents_by_sector_id(sector_id)
        updated_count = 0
        for document in documents:
            sector_sigla = getattr(getattr(document, "sector", None), "sigla", None)
            document.code = self._build_document_code(
                document_type=document.document_type,
                document_id=document.id,
                sector_sigla=sector_sigla,
            )
            self.repository.save_document(document)
            updated_count += 1
        return updated_count

    def _sync_document_codes_for_document_type(self, document_type_sigla: str) -> int:
        documents = self.repository.list_documents_by_document_type(document_type_sigla)
        updated_count = 0
        for document in documents:
            sector_sigla = getattr(getattr(document, "sector", None), "sigla", None)
            document.code = self._build_document_code(
                document_type=document.document_type,
                document_id=document.id,
                sector_sigla=sector_sigla,
            )
            self.repository.save_document(document)
            updated_count += 1
        return updated_count

    @staticmethod
    def _build_document_code(*, document_type: str, document_id: int, sector_sigla: str | None) -> str:
        normalized_type = AdminCatalogService._slug_segment(document_type) or "DOC"
        normalized_sector = AdminCatalogService._slug_segment(sector_sigla or "") or "SET"
        return f"{normalized_type}-{normalized_sector}-{document_id}"

    @staticmethod
    def _slug_segment(value: str) -> str:
        stripped = unicodedata.normalize("NFKD", value or "")
        ascii_only = stripped.encode("ascii", "ignore").decode("ascii")
        clean = re.sub(r"[^A-Za-z0-9]+", "", ascii_only)
        return clean.upper()

    @classmethod
    def _normalize_title_words_with_exceptions(cls, value: str) -> str:
        normalized = cls._normalize_text(value)
        words = normalized.split(" ")
        transformed_words = []
        for index, word in enumerate(words):
            lower_word = word.lower()
            if index > 0 and lower_word in cls._LOWERCASE_WORDS:
                transformed_words.append(lower_word)
                continue
            if cls._is_explicit_uppercase_word(word):
                transformed_words.append(word.upper())
                continue
            transformed_words.append(lower_word.capitalize())
        return " ".join(transformed_words)

    @staticmethod
    def _is_explicit_uppercase_word(word: str) -> bool:
        letters = [char for char in word if char.isalpha()]
        if len(letters) < 2:
            return False
        return all(char.isupper() for char in letters)

    @staticmethod
    def _ensure_catalog_manager(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.ADMIN):
            raise ForbiddenServiceError("Only admin users can manage catalog data.")

    @staticmethod
    def _actor_snapshot(current_user: AuthenticatedUser) -> str | None:
        return current_user.username or current_user.email

    @staticmethod
    def _company_entity_label(company_id: int, company_name: str | None) -> str:
        if company_name:
            return f"Empresa #{company_id} ({company_name})"
        return f"Empresa #{company_id}"

    @staticmethod
    def _sector_entity_label(sector_id: int, sector_name: str | None) -> str:
        if sector_name:
            return f"Setor #{sector_id} ({sector_name})"
        return f"Setor #{sector_id}"

    @staticmethod
    def _document_type_entity_label(document_type_id: int, document_type_name: str | None) -> str:
        if document_type_name:
            return f"Tipo documental #{document_type_id} ({document_type_name})"
        return f"Tipo documental #{document_type_id}"
