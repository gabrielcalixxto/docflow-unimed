from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from jose import jwt

from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import hash_password
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService, InvalidCredentialsError


def test_login_returns_bearer_token_with_claims_from_database_user() -> None:
    repository = Mock()
    repository.get_user_by_email.return_value = SimpleNamespace(
        id=7,
        email="coord.nutricao@example.com",
        role=UserRole.COORDENADOR,
        password_hash=hash_password("secret"),
    )
    service = AuthService(repository=repository)

    response = service.login(LoginRequest(email="coord.nutricao@example.com", password="secret"))
    decoded = jwt.decode(
        response.access_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert response.token_type == "bearer"
    assert decoded["sub"] == "coord.nutricao@example.com"
    assert decoded["role"] == UserRole.COORDENADOR.value
    assert decoded["user_id"] == 7
    repository.get_user_by_email.assert_called_once_with("coord.nutricao@example.com")


def test_login_raises_invalid_credentials_when_user_does_not_exist() -> None:
    repository = Mock()
    repository.get_user_by_email.return_value = None
    service = AuthService(repository=repository)

    with pytest.raises(InvalidCredentialsError):
        service.login(LoginRequest(email="inexistente@example.com", password="secret"))


def test_login_raises_invalid_credentials_on_wrong_password() -> None:
    repository = Mock()
    repository.get_user_by_email.return_value = SimpleNamespace(
        id=9,
        email="autor@example.com",
        role=UserRole.AUTOR,
        password_hash=hash_password("senha-correta"),
    )
    service = AuthService(repository=repository)

    with pytest.raises(InvalidCredentialsError):
        service.login(LoginRequest(email="autor@example.com", password="senha-incorreta"))
