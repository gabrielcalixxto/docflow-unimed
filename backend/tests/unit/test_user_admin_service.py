from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.enums import UserRole
from app.core.security import AuthenticatedUser, verify_password
from app.schemas.common import MessageResponse
from app.schemas.user_admin import UserAdminCreate, UserAdminUpdate
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError
from app.services.user_admin_service import UserAdminService


def build_service(*, repository: Mock | None = None) -> UserAdminService:
    user_repository = repository or Mock()
    user_repository.db = user_repository.db if hasattr(user_repository, "db") else Mock()
    return UserAdminService(repository=user_repository)


def admin_user() -> AuthenticatedUser:
    return AuthenticatedUser(email="admin@docflow.local", role=UserRole.ADMIN, roles=[UserRole.ADMIN], user_id=1)


def test_list_users_returns_repository_items_for_admin() -> None:
    repository = Mock()
    repository.list_users.return_value = [SimpleNamespace(id=1)]
    service = build_service(repository=repository)

    users = service.list_users(admin_user())

    assert len(users) == 1
    repository.list_users.assert_called_once_with()


def test_list_users_blocks_non_admin() -> None:
    repository = Mock()
    service = build_service(repository=repository)
    current_user = AuthenticatedUser(
        email="autor@example.com",
        role=UserRole.AUTOR,
        roles=[UserRole.AUTOR],
        user_id=10,
    )

    with pytest.raises(ForbiddenServiceError):
        service.list_users(current_user)


def test_create_user_persists_user_with_hashed_password() -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_id.return_value = SimpleNamespace(id=1)
    repository.get_sector_by_id.return_value = SimpleNamespace(id=10, company_id=1)
    repository.get_user_by_email.return_value = None
    repository.get_user_by_username.return_value = None
    repository.create_user.return_value = SimpleNamespace(id=7)
    service = build_service(repository=repository)
    payload = UserAdminCreate(
        name="Novo Usuario",
        email="novo@docflow.local",
        password="123456",
        roles=[UserRole.AUTOR],
        company_ids=[1],
        sector_ids=[10],
    )

    response = service.create_user(payload, admin_user())

    assert isinstance(response, MessageResponse)
    assert "created" in response.message.lower()
    repository.create_user.assert_called_once()
    assert repository.create_user.call_args.kwargs["username"] == "novo.usuario"
    hashed_password = repository.create_user.call_args.kwargs["password_hash"]
    assert hashed_password != payload.password
    assert verify_password(payload.password, hashed_password) is True
    repository.db.commit.assert_called_once_with()


def test_update_user_raises_not_found_when_user_missing() -> None:
    repository = Mock()
    repository.get_user_by_id.return_value = None
    service = build_service(repository=repository)
    payload = UserAdminUpdate(
        name="A",
        email="a@docflow.local",
        roles=[UserRole.ADMIN],
        sector_ids=[],
    )

    with pytest.raises(NotFoundServiceError):
        service.update_user(999, payload, admin_user())


def test_update_user_rejects_duplicated_email() -> None:
    repository = Mock()
    repository.get_user_by_id.return_value = SimpleNamespace(id=7)
    repository.get_user_by_email.return_value = SimpleNamespace(id=8)
    service = build_service(repository=repository)
    payload = UserAdminUpdate(
        name="A",
        email="duplicado@docflow.local",
        roles=[UserRole.ADMIN],
        sector_ids=[],
    )

    with pytest.raises(ConflictServiceError):
        service.update_user(7, payload, admin_user())


def test_delete_user_blocks_self_deletion() -> None:
    repository = Mock()
    service = build_service(repository=repository)

    with pytest.raises(ConflictServiceError):
        service.delete_user(1, admin_user())


def test_get_options_returns_roles_and_sectors() -> None:
    repository = Mock()
    repository.list_companies.return_value = [SimpleNamespace(id=1, name="Hospital")]
    repository.list_sectors.return_value = [SimpleNamespace(id=10, name="Qualidade", company_id=1)]
    service = build_service(repository=repository)

    options = service.get_options(admin_user())

    assert options.companies[0].id == 1
    assert options.sectors[0].id == 10
    assert UserRole.ADMIN in options.roles
