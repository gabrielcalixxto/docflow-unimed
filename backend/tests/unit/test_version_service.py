from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.enums import DocumentEventType, DocumentStatus, UserRole
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


def test_create_version_persists_draft_and_emits_event(version_payload, current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    created_version = SimpleNamespace(id=44)
    repository.get_version_by_number.return_value = None
    repository.create_version.return_value = created_version
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = SimpleNamespace(id=7)
    audit_service = Mock()
    service = build_service(
        repository=repository,
        document_repository=document_repository,
        audit_service=audit_service,
    )

    response = service.create_version(7, version_payload, current_user)

    assert isinstance(response, MessageResponse)
    assert "created" in response.message.lower()
    repository.create_version.assert_called_once_with(
        document_id=7,
        payload=version_payload,
        created_by=current_user.user_id,
    )
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
    document_repository.get_document_by_id.return_value = SimpleNamespace(id=7)
    service = build_service(repository=repository, document_repository=document_repository)

    with pytest.raises(ConflictServiceError):
        service.create_version(7, payload, current_user)


def test_create_version_raises_conflict_when_version_number_exists(version_payload, current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_version_by_number.return_value = SimpleNamespace(id=1)
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = SimpleNamespace(id=7)
    service = build_service(repository=repository, document_repository=document_repository)

    with pytest.raises(ConflictServiceError):
        service.create_version(7, version_payload, current_user)


def test_create_version_blocks_reader_role(version_payload) -> None:
    repository = Mock()
    repository.db = Mock()
    document_repository = Mock()
    document_repository.get_document_by_id.return_value = SimpleNamespace(id=7)
    service = build_service(repository=repository, document_repository=document_repository)
    reader = AuthenticatedUser(email="reader@example.com", role=UserRole.LEITOR, user_id=9)

    with pytest.raises(ForbiddenServiceError):
        service.create_version(7, version_payload, reader)


def test_list_versions_delegates_to_repository(fake_version) -> None:
    repository = Mock()
    repository.list_versions_for_document.return_value = [fake_version]
    service = build_service(repository=repository)

    result = service.list_versions(7)

    assert result == [fake_version]
    repository.list_versions_for_document.assert_called_once_with(7)
