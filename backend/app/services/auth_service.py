from app.core.enums import UserRole
from app.core.security import create_access_token, verify_password
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import LoginRequest, TokenResponse


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    def login(self, payload: LoginRequest) -> TokenResponse:
        user = self.repository.get_user_by_username(payload.username)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError

        return self._issue_token_from_user(user)

    def refresh_session(self, current_user_subject: str, current_user_id: int | None = None) -> TokenResponse:
        user = None
        if current_user_id is not None:
            user = self.repository.get_user_by_id(current_user_id)
        if user is None:
            user = self.repository.get_user_by_username(current_user_subject)
        if user is None:
            raise InvalidCredentialsError
        return self._issue_token_from_user(user)

    def _issue_token_from_user(self, user) -> TokenResponse:
        role = user.role if isinstance(user.role, UserRole) else self._parse_role(str(user.role))
        roles = [self._parse_role(role_value) for role_value in (getattr(user, "roles", None) or [])]
        if role not in roles:
            roles.append(role)

        sector_ids = [int(value) for value in (getattr(user, "sector_ids", None) or []) if isinstance(value, int)]
        user_sector_id = getattr(user, "sector_id", None)
        if user_sector_id is not None and user_sector_id not in sector_ids:
            sector_ids.append(user_sector_id)

        company_ids = [int(value) for value in (getattr(user, "company_ids", None) or []) if isinstance(value, int)]
        user_company_id = getattr(user, "company_id", None)
        if user_company_id is not None and user_company_id not in company_ids:
            company_ids.append(user_company_id)

        access_token = create_access_token(
            subject=user.username,
            role=role,
            roles=roles,
            email=user.email,
            user_id=user.id,
            company_id=user_company_id,
            company_ids=company_ids,
            sector_id=user_sector_id,
            sector_ids=sector_ids,
        )
        return TokenResponse(access_token=access_token, token_type="bearer")

    @staticmethod
    def _parse_role(value: str) -> UserRole:
        try:
            return UserRole(value)
        except ValueError:
            return UserRole.LEITOR
