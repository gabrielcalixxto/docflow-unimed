from sqlalchemy.exc import SQLAlchemyError

from app.core.audit import AuditContext
from app.core.enums import INACTIVE_USER_ROLES, UserRole
from app.core.security import AuthenticatedUser, hash_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.common import MessageResponse
from app.schemas.user_admin import UserAdminCreate, UserAdminOptionsRead, UserAdminUpdate
from app.services.audit_service import AuditService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


class UserAdminService:
    _LOWERCASE_WORDS = {"de", "do", "da"}

    def __init__(self, repository: UserRepository, audit_service: AuditService | None = None):
        self.repository = repository
        self.audit_service = audit_service or AuditService()

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

    def create_user(
        self,
        payload: UserAdminCreate,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_admin(current_user)
        self._ensure_no_inactive_roles(payload.roles)
        self._ensure_companies_exist(payload.company_ids)
        self._ensure_sectors_exist(payload.sector_ids)
        self._ensure_sector_company_consistency(payload.company_ids, payload.sector_ids)
        normalized_name = self._normalize_full_name(payload.name)
        normalized_job_title = self._normalize_job_title(payload.job_title)
        username = str(payload.username).strip().lower()
        self._ensure_email_available(str(payload.email).lower(), excluded_user_id=None)
        self._ensure_username_available(username, excluded_user_id=None)

        try:
            user = self.repository.create_user(
                payload=payload,
                name=normalized_name,
                job_title=normalized_job_title,
                username=username,
                password_hash=hash_password(payload.password),
            )
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="user",
                entity_id=user.id,
                action="CREATE",
                context=audit_context,
                entity_label=self._user_entity_label(user.id, normalized_name),
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
                        "field_name": "job_title",
                        "field_label": "Funcao",
                        "old_value": None,
                        "new_value": normalized_job_title,
                        "old_display_value": None,
                        "new_display_value": normalized_job_title,
                    },
                    {
                        "field_name": "username",
                        "field_label": "Login",
                        "old_value": None,
                        "new_value": username,
                        "old_display_value": None,
                        "new_display_value": username,
                    },
                    {
                        "field_name": "email",
                        "field_label": "E-mail",
                        "old_value": None,
                        "new_value": str(payload.email).lower(),
                        "old_display_value": None,
                        "new_display_value": str(payload.email).lower(),
                    },
                    {
                        "field_name": "is_active",
                        "field_label": "Ativo",
                        "old_value": None,
                        "new_value": True,
                        "old_display_value": None,
                        "new_display_value": "Sim",
                    },
                    {
                        "field_name": "must_change_password",
                        "field_label": "Troca de senha obrigatoria",
                        "old_value": None,
                        "new_value": True,
                        "old_display_value": None,
                        "new_display_value": "Sim",
                    },
                    {
                        "field_name": "roles",
                        "field_label": "Papeis",
                        "old_value": None,
                        "new_value": [role.value for role in payload.roles],
                        "old_display_value": None,
                        "new_display_value": [role.value for role in payload.roles],
                    },
                    {
                        "field_name": "company_ids",
                        "field_label": "Empresas",
                        "old_value": None,
                        "new_value": payload.company_ids,
                        "old_display_value": None,
                        "new_display_value": self._company_names(payload.company_ids),
                    },
                    {
                        "field_name": "sector_ids",
                        "field_label": "Setores",
                        "old_value": None,
                        "new_value": payload.sector_ids,
                        "old_display_value": None,
                        "new_display_value": self._sector_names(payload.sector_ids),
                    },
                ],
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
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_admin(current_user)

        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise NotFoundServiceError("User not found.")

        self._ensure_no_inactive_roles(payload.roles, existing_roles=list(user.roles or []))
        self._ensure_companies_exist(payload.company_ids)
        self._ensure_sectors_exist(payload.sector_ids)
        self._ensure_sector_company_consistency(payload.company_ids, payload.sector_ids)
        normalized_name = self._normalize_full_name(payload.name)
        normalized_job_title = self._normalize_job_title(payload.job_title)
        email = str(payload.email).lower()
        self._ensure_email_available(email, excluded_user_id=user_id)

        previous_name = user.name
        previous_job_title = getattr(user, "job_title", None)
        previous_email = user.email
        previous_roles = list(user.roles or [])
        previous_company_ids = list(user.company_ids or [])
        previous_sector_ids = list(user.sector_ids or [])

        user.name = normalized_name
        user.job_title = normalized_job_title
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
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="user",
                entity_id=user.id,
                action="UPDATE",
                context=audit_context,
                entity_label=self._user_entity_label(user.id, user.name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": previous_name,
                        "new_value": user.name,
                        "old_display_value": previous_name,
                        "new_display_value": user.name,
                    },
                    {
                        "field_name": "job_title",
                        "field_label": "Funcao",
                        "old_value": previous_job_title,
                        "new_value": user.job_title,
                        "old_display_value": previous_job_title,
                        "new_display_value": user.job_title,
                    },
                    {
                        "field_name": "email",
                        "field_label": "E-mail",
                        "old_value": previous_email,
                        "new_value": user.email,
                        "old_display_value": previous_email,
                        "new_display_value": user.email,
                    },
                    {
                        "field_name": "roles",
                        "field_label": "Papeis",
                        "old_value": previous_roles,
                        "new_value": user.roles,
                        "old_display_value": previous_roles,
                        "new_display_value": user.roles,
                    },
                    {
                        "field_name": "company_ids",
                        "field_label": "Empresas",
                        "old_value": previous_company_ids,
                        "new_value": user.company_ids,
                        "old_display_value": self._company_names(previous_company_ids),
                        "new_display_value": self._company_names(user.company_ids or []),
                    },
                    {
                        "field_name": "sector_ids",
                        "field_label": "Setores",
                        "old_value": previous_sector_ids,
                        "new_value": user.sector_ids,
                        "old_display_value": self._sector_names(previous_sector_ids),
                        "new_display_value": self._sector_names(user.sector_ids or []),
                    },
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not update user with the provided data.") from exc

        return MessageResponse(message="User updated successfully.")

    def inactivate_user(
        self,
        user_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_admin(current_user)
        if current_user.user_id == user_id:
            raise ConflictServiceError("Admin user cannot inactivate itself.")

        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise NotFoundServiceError("User not found.")

        if not getattr(user, "is_active", True):
            return MessageResponse(message="User is already inactive.")

        previous_active = bool(getattr(user, "is_active", True))
        user.is_active = False

        try:
            self.repository.save(user)
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="user",
                entity_id=user.id,
                action="UPDATE",
                context=audit_context,
                entity_label=self._user_entity_label(user.id, user.name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "is_active",
                        "field_label": "Ativo",
                        "old_value": previous_active,
                        "new_value": False,
                        "old_display_value": "Sim" if previous_active else "Nao",
                        "new_display_value": "Nao",
                    }
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not inactivate user.") from exc

        return MessageResponse(message="User inactivated successfully.")

    def reactivate_user(
        self,
        user_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_admin(current_user)

        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise NotFoundServiceError("User not found.")

        if bool(getattr(user, "is_active", True)):
            return MessageResponse(message="User is already active.")

        previous_active = bool(getattr(user, "is_active", True))
        user.is_active = True

        try:
            self.repository.save(user)
            self.audit_service.create_field_change_logs(
                user_id=current_user.user_id,
                entity_type="user",
                entity_id=user.id,
                action="UPDATE",
                context=audit_context,
                entity_label=self._user_entity_label(user.id, user.name),
                actor_name=self._actor_snapshot(current_user),
                changes=[
                    {
                        "field_name": "is_active",
                        "field_label": "Ativo",
                        "old_value": previous_active,
                        "new_value": True,
                        "old_display_value": "Sim" if previous_active else "Nao",
                        "new_display_value": "Sim",
                    }
                ],
            )
            self.repository.db.commit()
        except SQLAlchemyError as exc:
            self.repository.db.rollback()
            raise ConflictServiceError("Could not reactivate user.") from exc

        return MessageResponse(message="User reactivated successfully.")

    def delete_user(
        self,
        user_id: int,
        current_user: AuthenticatedUser,
        audit_context: AuditContext | None = None,
    ) -> MessageResponse:
        self._ensure_admin(current_user)
        if current_user.user_id == user_id:
            raise ConflictServiceError("Admin user cannot delete itself.")

        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise NotFoundServiceError("User not found.")

        try:
            self.audit_service.create_action_log(
                user_id=current_user.user_id,
                entity_type="user",
                entity_id=user.id,
                action="DELETE",
                field_name="record",
                old_value={
                    "name": user.name,
                    "job_title": getattr(user, "job_title", None),
                    "username": user.username,
                    "email": user.email,
                    "roles": user.roles,
                    "company_ids": user.company_ids,
                    "sector_ids": user.sector_ids,
                },
                new_value=None,
                context=audit_context,
                field_label="Registro",
                old_display_value=f"{user.name} ({user.username})",
                new_display_value=None,
                entity_label=self._user_entity_label(user.id, user.name),
                actor_name=self._actor_snapshot(current_user),
            )
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

    def _ensure_username_available(self, username: str, excluded_user_id: int | None) -> None:
        existing = self.repository.get_user_by_username(username)
        if existing is None:
            return
        if excluded_user_id is not None and existing.id == excluded_user_id:
            return
        raise ConflictServiceError("Username is already in use by another user.")

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

    @classmethod
    def _normalize_full_name(cls, value: str) -> str:
        normalized = " ".join((value or "").strip().split())
        words = [word for word in normalized.split(" ") if word]
        if len(words) < 2:
            raise ConflictServiceError("Full name must include at least first name and last name.")
        transformed_words: list[str] = []
        for index, word in enumerate(words):
            lower_word = word.lower()
            if index > 0 and lower_word in cls._LOWERCASE_WORDS:
                transformed_words.append(lower_word)
                continue
            transformed_words.append(lower_word.capitalize())
        return " ".join(transformed_words)

    @staticmethod
    def _normalize_job_title(value: str | None) -> str:
        normalized = " ".join((value or "").strip().split())
        if not normalized:
            raise ConflictServiceError("Function is required.")
        return normalized

    @staticmethod
    def _ensure_admin(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.ADMIN):
            raise ForbiddenServiceError("Only admin users can manage users.")

    @staticmethod
    def _ensure_no_inactive_roles(
        roles: list[UserRole],
        existing_roles: list[str | UserRole] | None = None,
    ) -> None:
        existing_roles_set = {
            role.value if isinstance(role, UserRole) else str(role)
            for role in (existing_roles or [])
        }
        for role in roles:
            # Allow keeping legacy inactive roles already present in user,
            # but block assigning inactive roles to new users/updates.
            if role in INACTIVE_USER_ROLES and role.value not in existing_roles_set:
                raise ConflictServiceError(f"Role {role.value} is inactive and cannot be assigned.")

    def _company_names(self, company_ids: list[int]) -> list[str]:
        names: list[str] = []
        for company_id in company_ids:
            company = self.repository.get_company_by_id(company_id)
            if company is not None:
                names.append(getattr(company, "name", None) or f"Empresa #{company_id}")
            else:
                names.append(f"Empresa #{company_id}")
        return names

    def _sector_names(self, sector_ids: list[int]) -> list[str]:
        names: list[str] = []
        for sector_id in sector_ids:
            sector = self.repository.get_sector_by_id(sector_id)
            if sector is not None:
                names.append(getattr(sector, "name", None) or f"Setor #{sector_id}")
            else:
                names.append(f"Setor #{sector_id}")
        return names

    @staticmethod
    def _actor_snapshot(current_user: AuthenticatedUser) -> str | None:
        return current_user.username or current_user.email

    @staticmethod
    def _user_entity_label(user_id: int, user_name: str | None) -> str:
        if user_name:
            return f"Usuario #{user_id} ({user_name})"
        return f"Usuario #{user_id}"
