from types import SimpleNamespace
from unittest.mock import Mock

from app.core.enums import UserRole
from app.core.security import AuthenticatedUser


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


def test_get_stored_file_returns_inline_content(authorized_client, monkeypatch) -> None:
    import app.routers.files as files_router

    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = authorized_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

    assert response.status_code == 200
    assert response.content == b"abc"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'inline; filename="manual.pdf"'


def test_get_stored_file_returns_attachment_when_download_query_is_true(
    authorized_client, monkeypatch
) -> None:
    import app.routers.files as files_router

    repository = Mock()
    repository.get_by_storage_key.return_value = SimpleNamespace(
        content=b"abc",
        content_type="application/pdf",
        original_name="manual.pdf",
    )
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = authorized_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?download=true")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == 'attachment; filename="manual.pdf"'


def test_get_stored_file_returns_404_when_missing(authorized_client, monkeypatch) -> None:
    import app.routers.files as files_router

    repository = Mock()
    repository.get_by_storage_key.return_value = None
    monkeypatch.setattr(files_router, "StoredFileRepository", lambda _: repository)

    response = authorized_client.get("/file-storage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

    assert response.status_code == 404
    assert response.json() == {"detail": "Arquivo nao encontrado."}
