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
    repository.get_user_by_username.return_value = SimpleNamespace(
        id=7,
        username="coordenacao.qualidade",
        email="coord.nutricao@example.com",
        role=UserRole.COORDENADOR,
        roles=[UserRole.COORDENADOR.value],
        sector_id=10,
        sector_ids=[10],
        password_hash=hash_password("secret"),
    )
    service = AuthService(repository=repository)

    response = service.login(LoginRequest(username="coordenacao.qualidade", password="secret"))
    decoded = jwt.decode(
        response.access_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert response.token_type == "bearer"
    assert decoded["sub"] == "coordenacao.qualidade"
    assert decoded["email"] == "coord.nutricao@example.com"
    assert decoded["role"] == UserRole.COORDENADOR.value
    assert decoded["roles"] == [UserRole.COORDENADOR.value]
    assert decoded["user_id"] == 7
    assert decoded["sector_id"] == 10
    assert decoded["sector_ids"] == [10]
    repository.get_user_by_username.assert_called_once_with("coordenacao.qualidade")


def test_login_raises_invalid_credentials_when_user_does_not_exist() -> None:
    repository = Mock()
    repository.get_user_by_username.return_value = None
    service = AuthService(repository=repository)

    with pytest.raises(InvalidCredentialsError):
        service.login(LoginRequest(username="inexistente.usuario", password="secret"))


def test_login_raises_invalid_credentials_on_wrong_password() -> None:
    repository = Mock()
    repository.get_user_by_username.return_value = SimpleNamespace(
        id=9,
        username="autor.docflow",
        email="autor@example.com",
        role=UserRole.AUTOR,
        roles=[UserRole.AUTOR.value],
        sector_ids=[],
        password_hash=hash_password("senha-correta"),
    )
    service = AuthService(repository=repository)

    with pytest.raises(InvalidCredentialsError):
        service.login(LoginRequest(username="autor.docflow", password="senha-incorreta"))
