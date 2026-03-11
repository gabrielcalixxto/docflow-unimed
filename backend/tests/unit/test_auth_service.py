from jose import jwt

from app.core.config import settings
from app.core.enums import UserRole
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService


def test_infer_role_from_email_prefixes() -> None:
    service = AuthService()

    assert service._infer_role_from_email("admin.ops@example.com") == UserRole.ADMIN
    assert service._infer_role_from_email("coord.nutricao@example.com") == UserRole.COORDENADOR
    assert service._infer_role_from_email("autor.qualidade@example.com") == UserRole.AUTOR
    assert service._infer_role_from_email("leitor@example.com") == UserRole.LEITOR


def test_login_returns_bearer_token_with_claims() -> None:
    service = AuthService()

    response = service.login(LoginRequest(email="coord@example.com", password="secret"))
    decoded = jwt.decode(
        response.access_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert response.token_type == "bearer"
    assert decoded["sub"] == "coord@example.com"
    assert decoded["role"] == UserRole.COORDENADOR.value
