from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.schemas.common import MessageResponse
from app.services.errors import ConflictServiceError, ForbiddenServiceError
from main import app


@pytest.fixture
def admin_authorized_client():
    from app.core.database import get_db
    from app.core.security import get_current_user

    def override_get_current_user() -> AuthenticatedUser:
        return AuthenticatedUser(email="admin@docflow.local", role=UserRole.ADMIN, user_id=1)

    def override_get_db():
        yield Mock()

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


def test_list_admin_users_returns_items(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.list_users.return_value = [
        {
            "id": 1,
            "name": "Admin",
            "username": "admin.docflow",
            "email": "admin@docflow.local",
            "roles": ["ADMIN"],
            "role": "ADMIN",
            "sector_ids": [],
            "sector_id": None,
        }
    ]
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.get("/admin/users")

    assert response.status_code == 200
    assert response.json()[0]["email"] == "admin@docflow.local"


def test_get_admin_user_options_returns_data(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.get_options.return_value = {
        "roles": ["AUTOR", "REVISOR", "COORDENADOR", "LEITOR", "ADMIN"],
        "companies": [{"id": 1, "name": "Hospital"}],
        "sectors": [{"id": 10, "name": "Qualidade", "company_id": 1}],
    }
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.get("/admin/users/options")

    assert response.status_code == 200
    assert response.json()["companies"][0]["id"] == 1
    assert response.json()["sectors"][0]["id"] == 10


def test_create_admin_user_returns_201(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.create_user.return_value = MessageResponse(message="created")
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.post(
        "/admin/users",
        json={
            "name": "Autor Teste",
            "username": "autor.teste",
            "email": "autor.novo@docflow.local",
            "password": "Senha@123",
            "roles": ["AUTOR", "REVISOR"],
            "company_ids": [1],
            "sector_ids": [10],
        },
    )

    assert response.status_code == 201
    assert response.json() == {"message": "created"}


def test_update_admin_user_returns_200(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.update_user.return_value = MessageResponse(message="updated")
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.put(
        "/admin/users/7",
        json={
            "name": "Autor Teste",
            "username": "autor.teste",
            "email": "autor.novo@docflow.local",
            "password": None,
            "roles": ["AUTOR"],
            "company_ids": [1],
            "sector_ids": [10],
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "updated"}


def test_delete_admin_user_returns_200(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.delete_user.return_value = MessageResponse(message="deleted")
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.delete("/admin/users/7")

    assert response.status_code == 200
    assert response.json() == {"message": "deleted"}


def test_admin_users_returns_403_when_service_blocks(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.list_users.side_effect = ForbiddenServiceError("Only admin users can manage users.")
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.get("/admin/users")

    assert response.status_code == 403
    assert response.json() == {"detail": "Only admin users can manage users."}


def test_create_admin_user_returns_409_on_conflict(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_users as admin_users_router

    service = Mock()
    service.create_user.side_effect = ConflictServiceError("Email is already in use by another user.")
    monkeypatch.setattr(admin_users_router, "get_user_admin_service", lambda _: service)

    response = admin_authorized_client.post(
        "/admin/users",
        json={
            "name": "Autor Teste",
            "username": "autor.teste",
            "email": "autor.novo@docflow.local",
            "password": "Senha@123",
            "roles": ["AUTOR"],
            "company_ids": [1],
            "sector_ids": [10],
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email is already in use by another user."}
