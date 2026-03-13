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

        roles = [self._parse_role(role) for role in (getattr(user, "roles", None) or [])]
        if user.role not in roles:
            roles.append(user.role)

        sector_ids = [
            int(value) for value in (getattr(user, "sector_ids", None) or []) if isinstance(value, int)
        ]
        if getattr(user, "sector_id", None) is not None and user.sector_id not in sector_ids:
            sector_ids.append(user.sector_id)

        company_ids = [
            int(value) for value in (getattr(user, "company_ids", None) or []) if isinstance(value, int)
        ]
        if getattr(user, "company_id", None) is not None and user.company_id not in company_ids:
            company_ids.append(user.company_id)

        access_token = create_access_token(
            subject=user.username,
            role=user.role,
            roles=roles,
            email=user.email,
            user_id=user.id,
            company_id=getattr(user, "company_id", None),
            company_ids=company_ids,
            sector_id=getattr(user, "sector_id", None),
            sector_ids=sector_ids,
        )
        return TokenResponse(access_token=access_token, token_type="bearer")

    @staticmethod
    def _parse_role(value: str) -> UserRole:
        try:
            return UserRole(value)
        except ValueError:
            return UserRole.LEITOR
