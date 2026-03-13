import re
import unicodedata

from sqlalchemy.exc import SQLAlchemyError

from app.core.enums import UserRole
from app.core.security import AuthenticatedUser, hash_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.common import MessageResponse
from app.schemas.user_admin import UserAdminCreate, UserAdminOptionsRead, UserAdminUpdate
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class UserAdminService:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def list_users(self, current_user: AuthenticatedUser) -> list[User]:
        self._ensure_admin(current_user)
        return self.repository.list_users()

    def get_options(self, current_user: AuthenticatedUser) -> UserAdminOptionsRead:
        self._ensure_admin(current_user)
        return UserAdminOptionsRead(
            roles=list(UserRole),
            companies=self.repository.list_companies(),
            sectors=self.repository.list_sectors(),
        )

    def create_user(self, payload: UserAdminCreate, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_admin(current_user)
        self._ensure_companies_exist(payload.company_ids)
        self._ensure_sectors_exist(payload.sector_ids)
        self._ensure_sector_company_consistency(payload.company_ids, payload.sector_ids)
        self._ensure_email_available(str(payload.email).lower(), excluded_user_id=None)
        username = self._build_unique_username(payload.name)

        try:
            user = self.repository.create_user(
                payload=payload,
                username=username,
                password_hash=hash_password(payload.password),
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not create user with the provided data.") from exc

        return MessageResponse(message=f"User created successfully (id={user.id}).")

    def update_user(
        self,
        user_id: int,
        payload: UserAdminUpdate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self._ensure_admin(current_user)

        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise NotFoundServiceError("User not found.")

        self._ensure_companies_exist(payload.company_ids)
        self._ensure_sectors_exist(payload.sector_ids)
        self._ensure_sector_company_consistency(payload.company_ids, payload.sector_ids)
        email = str(payload.email).lower()
        self._ensure_email_available(email, excluded_user_id=user_id)
        username = self._build_unique_username(payload.name, excluded_user_id=user_id)

        user.name = payload.name.strip()
        user.username = username
        user.email = email
        user.role = payload.roles[0]
        user.roles = [role.value for role in payload.roles]
        user.company_id = payload.company_ids[0] if payload.company_ids else None
        user.company_ids = payload.company_ids
        user.sector_id = payload.sector_ids[0] if payload.sector_ids else None
        user.sector_ids = payload.sector_ids
        if payload.password:
            user.password_hash = hash_password(payload.password)

        try:
            self.repository.save(user)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update user with the provided data.") from exc

        return MessageResponse(message="User updated successfully.")

    def delete_user(self, user_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_admin(current_user)
        if current_user.user_id == user_id:
            raise ConflictServiceError("Admin user cannot delete itself.")

        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise NotFoundServiceError("User not found.")

        try:
            self.repository.delete(user)
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not delete user due to existing references.") from exc

        return MessageResponse(message="User deleted successfully.")

    def _ensure_email_available(self, email: str, excluded_user_id: int | None) -> None:
        existing = self.repository.get_user_by_email(email)
        if existing is None:
            return
        if excluded_user_id is not None and existing.id == excluded_user_id:
            return
        raise ConflictServiceError("Email is already in use by another user.")

    def _ensure_sectors_exist(self, sector_ids: list[int]) -> None:
        for sector_id in sector_ids:
            sector = self.repository.get_sector_by_id(sector_id)
            if sector is None:
                raise NotFoundServiceError(f"Sector not found: {sector_id}.")

    def _ensure_companies_exist(self, company_ids: list[int]) -> None:
        for company_id in company_ids:
            company = self.repository.get_company_by_id(company_id)
            if company is None:
                raise NotFoundServiceError(f"Company not found: {company_id}.")

    def _ensure_sector_company_consistency(self, company_ids: list[int], sector_ids: list[int]) -> None:
        if not sector_ids:
            return
        if not company_ids:
            raise ConflictServiceError("Select at least one company before selecting sectors.")

        for sector_id in sector_ids:
            sector = self.repository.get_sector_by_id(sector_id)
            if sector is None:
                raise NotFoundServiceError(f"Sector not found: {sector_id}.")
            if sector.company_id not in company_ids:
                raise ConflictServiceError(
                    f"Sector {sector_id} does not belong to selected companies."
                )

    def _build_unique_username(self, name: str, excluded_user_id: int | None = None) -> str:
        base_username = self._normalize_username_from_name(name)
        candidate = base_username
        suffix = 1
        while True:
            existing = self.repository.get_user_by_username(candidate)
            if existing is None or (excluded_user_id is not None and existing.id == excluded_user_id):
                return candidate
            suffix += 1
            candidate = f"{base_username}.{suffix}"

    @staticmethod
    def _normalize_username_from_name(name: str) -> str:
        normalized = unicodedata.normalize("NFKD", (name or "").strip())
        ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()
        segments = re.findall(r"[a-z0-9]+", ascii_only)
        if len(segments) < 2:
            raise ConflictServiceError("Name must include at least nome e sobrenome.")
        username = ".".join(segments)
        if len(username) < 3:
            raise ConflictServiceError("User name must produce a valid login in format nome.sobrenome.")
        return username

    @staticmethod
    def _ensure_admin(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.ADMIN):
            raise ForbiddenServiceError("Only admin users can manage users.")
