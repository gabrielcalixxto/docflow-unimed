import pytest
from fastapi import HTTPException
from jose import jwt
from starlette.requests import Request

from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import (
    PASSWORD_CHANGE_REQUIRED_DETAIL,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)


def build_request(method: str, path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": [],
        }
    )


def test_hash_and_verify_password_roundtrip() -> None:
    hashed = hash_password("minha-senha")

    assert hashed != "minha-senha"
    assert verify_password("minha-senha", hashed) is True
    assert verify_password("outra-senha", hashed) is False


def test_create_access_token_includes_role_and_user_id() -> None:
    token = create_access_token(
        subject="autor.docflow",
        role=UserRole.AUTOR,
        roles=[UserRole.AUTOR, UserRole.REVISOR],
        email="autor@example.com",
        user_id=42,
        sector_ids=[10, 12],
        must_change_password=True,
    )
    decoded = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

    assert decoded["sub"] == "autor.docflow"
    assert decoded["email"] == "autor@example.com"
    assert decoded["role"] == UserRole.AUTOR.value
    assert decoded["roles"] == [UserRole.AUTOR.value, UserRole.REVISOR.value]
    assert decoded["user_id"] == 42
    assert decoded["sector_ids"] == [10, 12]
    assert decoded["must_change_password"] is True
    assert "exp" in decoded


def test_get_current_user_returns_authenticated_user() -> None:
    token = create_access_token(
        subject="admin.docflow",
        role=UserRole.ADMIN,
        roles=[UserRole.ADMIN, UserRole.REVISOR],
        email="admin@example.com",
        user_id=7,
        sector_ids=[9],
    )
    user = get_current_user(build_request("GET", "/search/documents"), token)

    assert user.email == "admin@example.com"
    assert user.role == UserRole.ADMIN
    assert user.username == "admin.docflow"
    assert not user.has_role(UserRole.REVISOR)
    assert user.has_role(UserRole.AUTOR)
    assert user.has_role(UserRole.COORDENADOR)
    assert user.normalized_sector_ids() == [9]
    assert user.user_id == 7
    assert user.must_change_password is False


def test_get_current_user_raises_401_on_invalid_token() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(build_request("GET", "/search/documents"), "invalid.token.value")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials."


def test_get_current_user_blocks_non_auth_routes_when_password_change_is_required() -> None:
    token = create_access_token(
        subject="autor.docflow",
        role=UserRole.AUTOR,
        email="autor@example.com",
        user_id=10,
        must_change_password=True,
    )

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(build_request("GET", "/documents"), token)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == PASSWORD_CHANGE_REQUIRED_DETAIL


def test_get_current_user_allows_change_password_route_when_password_change_is_required() -> None:
    token = create_access_token(
        subject="autor.docflow",
        role=UserRole.AUTOR,
        email="autor@example.com",
        user_id=10,
        must_change_password=True,
    )

    current_user = get_current_user(build_request("POST", "/auth/change-password"), token)

    assert current_user.user_id == 10
    assert current_user.must_change_password is True
