from unittest.mock import Mock

from jose import jwt

from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import create_access_token
from app.schemas.auth import TokenResponse
from app.services.auth_service import InvalidCredentialsError
from main import app


def test_healthcheck_returns_ok(public_client) -> None:
    response = public_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_auth_login_returns_jwt_bearer_token(public_client) -> None:
    import app.routers.auth as auth_router

    service = Mock()
    token = create_access_token(
        subject="coordenacao.qualidade",
        role=UserRole.COORDENADOR,
        roles=[UserRole.COORDENADOR],
        email="coord.nutricao@example.com",
        user_id=7,
        sector_ids=[10],
    )
    service.login.return_value = TokenResponse(access_token=token, token_type="bearer")
    app.dependency_overrides[auth_router.get_auth_service] = lambda: service

    try:
        response = public_client.post(
            "/auth/login",
            json={"username": "coordenacao.qualidade", "password": "secret"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["token_type"] == "bearer"
        decoded = jwt.decode(
            body["access_token"],
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        assert decoded["sub"] == "coordenacao.qualidade"
        assert decoded["email"] == "coord.nutricao@example.com"
        assert decoded["role"] == "COORDENADOR"
        assert decoded["roles"] == ["COORDENADOR"]
        assert decoded["user_id"] == 7
    finally:
        app.dependency_overrides.clear()


def test_auth_login_returns_401_on_invalid_credentials(public_client) -> None:
    import app.routers.auth as auth_router

    service = Mock()
    service.login.side_effect = InvalidCredentialsError
    app.dependency_overrides[auth_router.get_auth_service] = lambda: service

    try:
        response = public_client.post(
            "/auth/login",
            json={"username": "coordenacao.qualidade", "password": "wrong"},
        )

        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid username or password."}
    finally:
        app.dependency_overrides.clear()


def test_protected_documents_route_requires_authentication(public_client) -> None:
    response = public_client.get("/documents")

    assert response.status_code == 401
