from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.enums import DocumentEventType, DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.schemas.common import MessageResponse
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError
from app.services.version_service import VersionService


def build_service(
    *,
    repository: Mock | None = None,
    document_repository: Mock | None = None,
    audit_service: Mock | None = None,
) -> VersionService:
    versions = repository or Mock()
    versions.db = versions.db if hasattr(versions, "db") else Mock()
    documents = document_repository or Mock()
    audit = audit_service or Mock()
    return VersionService(
        repository=versions,
        document_repository=documents,
        audit_service=audit,
    )


def build_document(document_id: int = 7) -> SimpleNamespace:
    return SimpleNamespace(
        id=document_id,
        scope=DocumentScope.LOCAL,
        sector_id=10,
    )


def test_create_version_persists_draft_and_emits_event(version_payload, current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    created_version = SimpleNamespace(id=44)
    repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=11,
        version_number=1,
        status=DocumentStatus.VIGENTE,
    )
    repository.create_version.return_value = created_version
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = build_document(7)
    audit_service = Mock()
    service = build_service(
        repository=repository,
        document_repository=document_repository,
        audit_service=audit_service,
    )

    response = service.create_version(7, version_payload, current_user)

    assert isinstance(response, MessageResponse)
    assert "created" in response.message.lower()
    repository.create_version.assert_called_once()
    create_args = repository.create_version.call_args.kwargs
    assert create_args["document_id"] == 7
    assert create_args["created_by"] == current_user.user_id
    created_payload = create_args["payload"]
    assert created_payload.version_number == 2
    assert created_payload.status == DocumentStatus.RASCUNHO
    assert created_payload.file_path == version_payload.file_path
    assert created_payload.expiration_date == version_payload.expiration_date
    repository.db.commit.assert_called_once_with()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.VERSION_CREATED,
        document_id=7,
        version_id=44,
        user_id=current_user.user_id,
    )


def test_create_version_raises_not_found_when_document_missing(version_payload, current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = None
    service = build_service(repository=repository, document_repository=document_repository)

    with pytest.raises(NotFoundServiceError):
        service.create_version(999, version_payload, current_user)


def test_create_version_rejects_non_draft_status(version_payload, current_user) -> None:
    payload = version_payload.model_copy(update={"status": DocumentStatus.VIGENTE})
    repository = Mock()
    repository.db = Mock()
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = build_document(7)
    service = build_service(repository=repository, document_repository=document_repository)

    with pytest.raises(ConflictServiceError):
        service.create_version(7, payload, current_user)


def test_create_version_raises_conflict_when_latest_version_is_in_progress(version_payload, current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=12,
        version_number=2,
        status=DocumentStatus.PENDENTE_COORDENACAO,
    )
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = build_document(7)
    service = build_service(repository=repository, document_repository=document_repository)

    with pytest.raises(ConflictServiceError):
        service.create_version(7, version_payload, current_user)


def test_create_version_blocks_reader_role(version_payload) -> None:
    repository = Mock()
    repository.db = Mock()
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = build_document(7)
    service = build_service(repository=repository, document_repository=document_repository)
    reader = AuthenticatedUser(email="reader@example.com", role=UserRole.LEITOR, user_id=9)

    with pytest.raises(ForbiddenServiceError):
        service.create_version(7, version_payload, reader)


def test_list_versions_delegates_to_repository(fake_version, current_user) -> None:
    repository = Mock()
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = build_document(7)
    repository.list_versions_for_document.return_value = [fake_version]
    service = build_service(repository=repository, document_repository=document_repository)

    result = service.list_versions(7, current_user)

    assert result == [fake_version]
    repository.list_versions_for_document.assert_called_once_with(7)
