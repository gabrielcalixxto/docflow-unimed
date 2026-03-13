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
            sectors=self.repository.list_sectors(),
        )

    def create_user(self, payload: UserAdminCreate, current_user: AuthenticatedUser) -> MessageResponse:
        self._ensure_admin(current_user)
        self._ensure_sector_exists(payload.sector_id)
        self._ensure_email_available(str(payload.email).lower(), excluded_user_id=None)

        try:
            user = self.repository.create_user(
                payload=payload,
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

        self._ensure_sector_exists(payload.sector_id)
        email = str(payload.email).lower()
        self._ensure_email_available(email, excluded_user_id=user_id)

        user.name = payload.name.strip()
        user.email = email
        user.role = payload.role
        user.sector_id = payload.sector_id
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

    def _ensure_sector_exists(self, sector_id: int | None) -> None:
        if sector_id is None:
            return
        sector = self.repository.get_sector_by_id(sector_id)
        if sector is None:
            raise NotFoundServiceError("Sector not found.")

    @staticmethod
    def _ensure_admin(current_user: AuthenticatedUser) -> None:
        if current_user.role != UserRole.ADMIN:
            raise ForbiddenServiceError("Only admin users can manage users.")
