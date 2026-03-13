from app.core.security import create_access_token, verify_password
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import LoginRequest, TokenResponse


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    def login(self, payload: LoginRequest) -> TokenResponse:
        user = self.repository.get_user_by_email(payload.email.lower())
        if user is None or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError

        access_token = create_access_token(
            subject=user.email,
            role=user.role,
            user_id=user.id,
            sector_id=getattr(user, "sector_id", None),
        )
        return TokenResponse(access_token=access_token, token_type="bearer")
