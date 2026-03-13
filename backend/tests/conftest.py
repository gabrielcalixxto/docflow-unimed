from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.core.enums import DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.schemas.document import DocumentCreate
from app.schemas.search import DocumentSearchResponse, DocumentSearchResult
from app.schemas.version import DocumentVersionCreate
from main import app


@pytest.fixture
def current_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        email="revisor@example.com",
        username="revisor.docflow",
        role=UserRole.REVISOR,
        roles=[UserRole.REVISOR],
        user_id=99,
        sector_id=10,
        sector_ids=[10],
    )


@pytest.fixture
def document_payload() -> DocumentCreate:
    return DocumentCreate(
        title="Manual de Nutricao",
        company_id=1,
        sector_id=10,
        document_type="POP",
        scope=DocumentScope.LOCAL,
        file_path="/tmp/doc-001-v1.pdf",
        expiration_date=date(2027, 1, 31),
    )


@pytest.fixture
def version_payload() -> DocumentVersionCreate:
    return DocumentVersionCreate(
        version_number=2,
        status=DocumentStatus.RASCUNHO,
        file_path="/tmp/doc-001-v2.pdf",
        expiration_date=date(2027, 1, 31),
    )


@pytest.fixture
def fake_document() -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        code="DOC-001",
        title="Manual de Nutricao",
        company_id=1,
        sector_id=10,
        document_type="POP",
        scope=DocumentScope.LOCAL,
        created_by=99,
        created_at=datetime(2026, 3, 1, 10, 0, tzinfo=UTC),
    )


@pytest.fixture
def fake_version() -> SimpleNamespace:
    return SimpleNamespace(
        id=11,
        document_id=1,
        version_number=2,
        status=DocumentStatus.VIGENTE,
        file_path="/tmp/doc-001-v2.pdf",
        created_by=99,
        approved_by=7,
        created_at=datetime(2026, 3, 1, 10, 0, tzinfo=UTC),
        approved_at=datetime(2026, 3, 2, 11, 0, tzinfo=UTC),
        expiration_date=date(2027, 1, 31),
    )


@pytest.fixture
def fake_search_response() -> DocumentSearchResponse:
    return DocumentSearchResponse(
        items=[
            DocumentSearchResult(
                document_id=1,
                code="DOC-001",
                title="Manual de Nutricao",
                document_type="POP",
                scope=DocumentScope.LOCAL,
                active_version_id=11,
                active_version_number=2,
                file_path="/tmp/doc-001-v2.pdf",
                expiration_date=date(2027, 1, 31),
            )
        ]
    )


@pytest.fixture
def authorized_client(current_user: AuthenticatedUser):
    from app.core.database import get_db
    from app.core.security import get_current_user

    def override_get_current_user() -> AuthenticatedUser:
        return current_user

    def override_get_db():
        yield Mock()

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def public_client():
    with TestClient(app) as client:
        yield client
