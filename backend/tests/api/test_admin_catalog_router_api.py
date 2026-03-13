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


def test_get_catalog_options_returns_data(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_catalog as admin_catalog_router

    service = Mock()
    service.get_options.return_value = {
        "companies": [{"id": 1, "name": "DocFlow Unimed"}],
        "sectors": [{"id": 10, "name": "Qualidade", "company_id": 1}],
        "document_types": [{"id": 100, "sigla": "POP", "name": "Procedimento Operacional Padrao"}],
    }
    monkeypatch.setattr(admin_catalog_router, "get_admin_catalog_service", lambda _: service)

    response = admin_authorized_client.get("/admin/catalog/options")

    assert response.status_code == 200
    assert response.json()["companies"][0]["id"] == 1
    assert response.json()["document_types"][0]["sigla"] == "POP"


def test_create_company_returns_201(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_catalog as admin_catalog_router

    service = Mock()
    service.create_company.return_value = MessageResponse(message="created")
    monkeypatch.setattr(admin_catalog_router, "get_admin_catalog_service", lambda _: service)

    response = admin_authorized_client.post("/admin/catalog/companies", json={"name": "Unimed Campinas"})

    assert response.status_code == 201
    assert response.json() == {"message": "created"}


def test_delete_sector_returns_200(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_catalog as admin_catalog_router

    service = Mock()
    service.delete_sector.return_value = MessageResponse(message="deleted")
    monkeypatch.setattr(admin_catalog_router, "get_admin_catalog_service", lambda _: service)

    response = admin_authorized_client.delete("/admin/catalog/sectors/10")

    assert response.status_code == 200
    assert response.json() == {"message": "deleted"}


def test_catalog_routes_return_403_when_service_blocks(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_catalog as admin_catalog_router

    service = Mock()
    service.get_options.side_effect = ForbiddenServiceError("Only admin users can manage catalog data.")
    monkeypatch.setattr(admin_catalog_router, "get_admin_catalog_service", lambda _: service)

    response = admin_authorized_client.get("/admin/catalog/options")

    assert response.status_code == 403
    assert response.json() == {"detail": "Only admin users can manage catalog data."}


def test_create_document_type_returns_409_on_conflict(admin_authorized_client, monkeypatch) -> None:
    import app.routers.admin_catalog as admin_catalog_router

    service = Mock()
    service.create_document_type.side_effect = ConflictServiceError("Document type already exists.")
    monkeypatch.setattr(admin_catalog_router, "get_admin_catalog_service", lambda _: service)

    response = admin_authorized_client.post(
        "/admin/catalog/document-types",
        json={"sigla": "POP", "name": "Procedimento Operacional Padrao"},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Document type already exists."}
