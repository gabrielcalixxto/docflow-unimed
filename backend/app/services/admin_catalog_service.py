import re
import unicodedata

from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.repositories.admin_catalog_repository import AdminCatalogRepository
from app.schemas.admin_catalog import (
    AdminCatalogOptionsRead,
    AdminCompanyCreate,
    AdminDocumentTypeCreate,
    AdminSectorCreate,
)
from app.schemas.common import MessageResponse
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class AdminCatalogService:
    _LOWERCASE_WORDS = {"de", "do", "da"}

    def __init__(self, repository: AdminCatalogRepository):
        self.repository = repository

    def get_options(self, current_user: AuthenticatedUser) -> AdminCatalogOptionsRead:
        self._ensure_admin(current_user)
        return AdminCatalogOptionsRead(
            companies=self.repository.list_companies(),
            sectors=self.repository.list_sectors(),
            document_types=self.repository.list_document_types(),
        )

    def create_company(
        self,
        payload: AdminCompanyCreate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self._ensure_admin(current_user)
        normalized_name = self._normalize_company_name(payload.name)
        if self.repository.get_company_by_name(normalized_name) is not None:
            raise ConflictServiceError("Company already exists.")

        try:
            company = self.repository.create_company(normalized_name)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create company with the provided data.") from exc

        return MessageResponse(message=f"Company created successfully (id={company.id}).")

    def delete_company(self, company_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_admin(current_user)
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
            self.repository.delete_company(company)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete company.") from exc

        return MessageResponse(message="Company deleted successfully.")

    def create_sector(
        self,
        payload: AdminSectorCreate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self._ensure_admin(current_user)
        company = self.repository.get_company_by_id(payload.company_id)
        if company is None:
            raise NotFoundServiceError("Company not found.")

        normalized_name = self._normalize_sector_name(payload.name)
        if self.repository.get_sector_by_name_and_company(normalized_name, payload.company_id) is not None:
            raise ConflictServiceError("Sector already exists for this company.")

        try:
            sector = self.repository.create_sector(name=normalized_name, company_id=payload.company_id)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create sector with the provided data.") from exc

        return MessageResponse(message=f"Sector created successfully (id={sector.id}).")

    def delete_sector(self, sector_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_admin(current_user)
        sector = self.repository.get_sector_by_id(sector_id)
        if sector is None:
            raise NotFoundServiceError("Sector not found.")

        if self.repository.count_sector_users(sector_id) > 0:
            raise ConflictServiceError("Cannot delete sector with linked users.")
        if self.repository.count_sector_documents(sector_id) > 0:
            raise ConflictServiceError("Cannot delete sector with linked documents.")

        try:
            self.repository.delete_sector(sector)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete sector.") from exc

        return MessageResponse(message="Sector deleted successfully.")

    def create_document_type(
        self,
        payload: AdminDocumentTypeCreate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self._ensure_admin(current_user)
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
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create document type.") from exc

        return MessageResponse(
            message=f"Document type created successfully (id={document_type.id}, sigla={document_type.sigla})."
        )

    def delete_document_type(self, document_type_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_admin(current_user)
        document_type = self.repository.get_document_type_by_id(document_type_id)
        if document_type is None:
            raise NotFoundServiceError("Document type not found.")

        try:
            self.repository.delete_document_type(document_type)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete document type.") from exc

        return MessageResponse(message="Document type deleted successfully.")

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
    def _normalize_company_name(cls, value: str) -> str:
        return cls._normalize_title_words_with_exceptions(value)

    @classmethod
    def _normalize_document_type_name(cls, value: str) -> str:
        return cls._normalize_title_words_with_exceptions(value)

    @classmethod
    def _normalize_document_type_sigla(cls, value: str) -> str:
        normalized = cls._normalize_text(value, upper=True)
        ascii_only = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii")
        alphanumeric_only = re.sub(r"[^A-Za-z0-9]+", "", ascii_only).upper()
        if len(alphanumeric_only) < 2:
            raise ConflictServiceError("Acronym must contain at least 2 alphanumeric characters.")
        return alphanumeric_only

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
            transformed_words.append(lower_word.capitalize())
        return " ".join(transformed_words)

    @staticmethod
    def _ensure_admin(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.ADMIN):
            raise ForbiddenServiceError("Only admin users can manage catalog data.")
