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


def test_login_supports_multiple_sessions_without_claim_interference() -> None:
    first_user = SimpleNamespace(
        id=11,
        username="autor.docflow",
        email="autor@example.com",
        role=UserRole.AUTOR,
        roles=[UserRole.AUTOR.value],
        company_id=1,
        company_ids=[1],
        sector_id=10,
        sector_ids=[10],
        password_hash=hash_password("secret"),
    )
    second_user = SimpleNamespace(
        id=12,
        username="coord.docflow",
        email="coord@example.com",
        role=UserRole.COORDENADOR,
        roles=[UserRole.COORDENADOR.value],
        company_id=2,
        company_ids=[2],
        sector_id=20,
        sector_ids=[20],
        password_hash=hash_password("secret"),
    )

    repository = Mock()

    def get_user_by_username(username: str):
        if username == "autor.docflow":
            return first_user
        if username == "coord.docflow":
            return second_user
        return None

    repository.get_user_by_username.side_effect = get_user_by_username
    service = AuthService(repository=repository)

    first_token = service.login(LoginRequest(username="autor.docflow", password="secret")).access_token
    second_token = service.login(LoginRequest(username="coord.docflow", password="secret")).access_token

    first_decoded = jwt.decode(
        first_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    second_decoded = jwt.decode(
        second_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert first_token != second_token
    assert first_decoded["sub"] == "autor.docflow"
    assert first_decoded["user_id"] == 11
    assert first_decoded["roles"] == [UserRole.AUTOR.value]
    assert first_decoded["company_ids"] == [1]
    assert first_decoded["sector_ids"] == [10]

    assert second_decoded["sub"] == "coord.docflow"
    assert second_decoded["user_id"] == 12
    assert second_decoded["roles"] == [UserRole.COORDENADOR.value]
    assert second_decoded["company_ids"] == [2]
    assert second_decoded["sector_ids"] == [20]


def test_refresh_session_returns_latest_roles_from_database() -> None:
    repository = Mock()
    repository.get_user_by_id.return_value = SimpleNamespace(
        id=7,
        username="coordenacao.qualidade",
        email="coord.nutricao@example.com",
        role=UserRole.ADMIN,
        roles=[UserRole.COORDENADOR.value, UserRole.ADMIN.value],
        company_id=1,
        company_ids=[1, 2],
        sector_id=10,
        sector_ids=[10, 11],
        password_hash=hash_password("secret"),
    )
    service = AuthService(repository=repository)

    response = service.refresh_session(
        current_user_subject="coordenacao.qualidade",
        current_user_id=7,
    )
    decoded = jwt.decode(
        response.access_token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert set(decoded["roles"]) == {UserRole.ADMIN.value, UserRole.COORDENADOR.value}
    assert decoded["role"] == UserRole.ADMIN.value
    assert decoded["company_ids"] == [1, 2]
    assert decoded["sector_ids"] == [10, 11]
    repository.get_user_by_id.assert_called_once_with(7)
