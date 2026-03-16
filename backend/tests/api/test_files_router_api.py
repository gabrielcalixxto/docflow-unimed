from types import SimpleNamespace
from unittest.mock import Mock

from app.core.enums import DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser


def _mock_file_token_auth(
    monkeypatch,
    *,
    role: UserRole = UserRole.REVISOR,
    user_id: int = 7,
    company_ids: list[int] | None = None,
    sector_ids: list[int] | None = None,
) -> None:
    import app.routers.files as files_router

    def fake_decode(_token: str) -> AuthenticatedUser:
        return AuthenticatedUser(
            email="user@example.com",
            username="user.docflow",
            role=role,
            roles=[role],
            user_id=user_id,
            company_ids=company_ids or [],
            sector_ids=sector_ids if sector_ids is not None else [10],
        )

    monkeypatch.setattr(files_router, "get_authenticated_user_from_token", fake_decode)


def _mock_file_audit_service(monkeypatch):
    import app.routers.files as files_router

    audit_service = Mock()
    monkeypatch.setattr(files_router, "AuditLogRepository", lambda _db: Mock())
    monkeypatch.setattr(files_router, "AuditService", lambda log_repository: audit_service)
    return audit_service


def test_upload_document_file_returns_storage_path(public_client, monkeypatch) -> None:
    import app.routers.files as files_router
    from app.core.database import get_db
    from app.core.security import get_current_user
    from main import app

    repository = Mock()
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)
    monkeypatch.setattr(files_router, "uuid4", lambda: SimpleNamespace(hex="a" * 32))

    def override_get_current_user() -> AuthenticatedUser:
        return AuthenticatedUser(email="autor@example.com", role=UserRole.AUTOR, user_id=7)

    def override_get_db():
        yield Mock()

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        response = public_client.post(
            "/file-storage/upload",
            files={"file": ("manual.pdf", b"conteudo", "application/pdf")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "file_path": "/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "original_name": "manual.pdf",
    }
    repository.create_file.assert_called_once()


def test_upload_document_file_returns_403_for_reader_role(public_client, monkeypatch) -> None:
    import app.routers.files as files_router
    from app.core.database import get_db
    from app.core.security import get_current_user
    from main import app

    def override_get_current_user() -> AuthenticatedUser:
        return AuthenticatedUser(email="leitor@example.com", role=UserRole.LEITOR, user_id=7)

    def override_get_db():
        yield Mock()

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: Mock())

    try:
        response = public_client.post(
            "/file-storage/upload",
            files={"file": ("manual.pdf", b"conteudo", "application/pdf")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json() == {"detail": "Only author role can upload files."}


def test_get_stored_file_returns_inline_content(public_client, monkeypatch) -> None:
    import app.routers.files as files_router

    _mock_file_token_auth(monkeypatch)
    audit_service = _mock_file_audit_service(monkeypatch)
    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
        document=SimpleNamespace(id=1, scope=DocumentScope.LOCAL, company_id=1, sector_id=10, created_by=8),
        version=SimpleNamespace(document_id=1, status=DocumentStatus.VIGENTE, created_by=8),
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?token=fake-token")

    assert response.status_code == 200
    assert response.content == b"abc"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'inline; filename="manual.pdf"'
    audit_service.create_action_log.assert_called_once()
    assert audit_service.create_action_log.call_args.kwargs["action"] == "VIEW_FILE"


def test_get_stored_file_returns_attachment_when_download_query_is_true(
    public_client, monkeypatch
) -> None:
    import app.routers.files as files_router

    _mock_file_token_auth(monkeypatch)
    audit_service = _mock_file_audit_service(monkeypatch)
    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
        document=SimpleNamespace(id=1, scope=DocumentScope.LOCAL, company_id=1, sector_id=10, created_by=8),
        version=SimpleNamespace(document_id=1, status=DocumentStatus.VIGENTE, created_by=8),
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?download=true&token=fake-token")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == 'attachment; filename="manual.pdf"'
    audit_service.create_action_log.assert_called_once()
    assert audit_service.create_action_log.call_args.kwargs["action"] == "DOWNLOAD_FILE"


def test_get_stored_file_returns_404_when_missing(public_client, monkeypatch) -> None:
    import app.routers.files as files_router

    _mock_file_token_auth(monkeypatch)
    _mock_file_audit_service(monkeypatch)
    repository = Mock()
    repository.get_by_storage_key.return_value = None
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?token=fake-token")

    assert response.status_code == 404
    assert response.json() == {"detail": "Arquivo nao encontrado."}


def test_get_stored_file_returns_401_without_token(public_client) -> None:
    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

    assert response.status_code == 401
    assert response.json() == {"detail": "Could not validate credentials."}


def test_get_stored_file_allows_corporate_for_any_user(public_client, monkeypatch) -> None:
    import app.routers.files as files_router

    _mock_file_token_auth(monkeypatch, role=UserRole.LEITOR, company_ids=[], sector_ids=[])
    audit_service = _mock_file_audit_service(monkeypatch)
    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
        document=SimpleNamespace(id=1, scope=DocumentScope.CORPORATIVO, company_id=1, sector_id=10, created_by=8),
        version=SimpleNamespace(document_id=1, status=DocumentStatus.VIGENTE, created_by=8),
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?token=fake-token")

    assert response.status_code == 200
    assert response.content == b"abc"
    audit_service.create_action_log.assert_called_once()


def test_get_stored_file_denies_local_document_for_other_sector(public_client, monkeypatch) -> None:
    import app.routers.files as files_router

    _mock_file_token_auth(monkeypatch, role=UserRole.LEITOR, company_ids=[], sector_ids=[99])
    _mock_file_audit_service(monkeypatch)
    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
        document=SimpleNamespace(id=1, scope=DocumentScope.LOCAL, company_id=1, sector_id=10, created_by=8),
        version=SimpleNamespace(document_id=1, status=DocumentStatus.VIGENTE, created_by=8),
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?token=fake-token")

    assert response.status_code == 403
    assert response.json() == {"detail": "You do not have permission to access this file."}


def test_get_stored_file_returns_403_for_non_vigente_without_privilege(public_client, monkeypatch) -> None:
    import app.routers.files as files_router

    _mock_file_token_auth(monkeypatch, role=UserRole.LEITOR, user_id=77)
    _mock_file_audit_service(monkeypatch)
    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
        document=SimpleNamespace(id=1, scope=DocumentScope.LOCAL, company_id=1, sector_id=10, created_by=8),
        version=SimpleNamespace(document_id=1, status=DocumentStatus.RASCUNHO, created_by=8),
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = public_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?token=fake-token")

    assert response.status_code == 403
    assert response.json() == {"detail": "You do not have permission to access this file version."}
