from app.core.enums import UserRole
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, TokenResponse


class AuthService:
    def login(self, payload: LoginRequest) -> TokenResponse:
        role = self._infer_role_from_email(payload.email)
        access_token = create_access_token(subject=payload.email, role=role)
        return TokenResponse(access_token=access_token, token_type="bearer")

    def _infer_role_from_email(self, email: str) -> UserRole:
        normalized_email = email.lower()
        if normalized_email.startswith("admin"):
            return UserRole.ADMIN
        if normalized_email.startswith("coord"):
            return UserRole.COORDENADOR
        if normalized_email.startswith("autor"):
            return UserRole.AUTOR
        return UserRole.LEITOR
