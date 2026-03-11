from unittest.mock import Mock

from app.core.enums import DocumentEventType
from app.schemas.common import MessageResponse
from app.services.version_service import VersionService


def test_create_version_emits_version_created_event(version_payload, current_user) -> None:
    repository = Mock()
    audit_service = Mock()
    service = VersionService(repository=repository, audit_service=audit_service)

    response = service.create_version(7, version_payload, current_user)

    assert isinstance(response, MessageResponse)
    assert "scaffolded" in response.message.lower()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.VERSION_CREATED,
        document_id=7,
        user_id=current_user.user_id,
    )


def test_list_versions_delegates_to_repository(fake_version) -> None:
    repository = Mock()
    repository.list_versions_for_document.return_value = [fake_version]
    service = VersionService(repository=repository, audit_service=Mock())

    result = service.list_versions(7)

    assert result == [fake_version]
    repository.list_versions_for_document.assert_called_once_with(7)
