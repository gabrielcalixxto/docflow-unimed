from unittest.mock import Mock

from app.core.enums import DocumentEventType
from app.schemas.common import MessageResponse
from app.services.document_service import DocumentService


def test_create_document_emits_document_created_event(document_payload, current_user) -> None:
    repository = Mock()
    audit_service = Mock()
    service = DocumentService(repository=repository, audit_service=audit_service)

    response = service.create_document(document_payload, current_user)

    assert isinstance(response, MessageResponse)
    assert "scaffolded" in response.message.lower()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.DOCUMENT_CREATED,
        user_id=current_user.user_id,
    )


def test_submit_for_review_emits_audit_event(current_user) -> None:
    repository = Mock()
    audit_service = Mock()
    service = DocumentService(repository=repository, audit_service=audit_service)

    response = service.submit_for_review(12, current_user)

    assert isinstance(response, MessageResponse)
    assert "submit review" in response.message.lower()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.SUBMITTED_FOR_REVIEW,
        document_id=12,
        user_id=current_user.user_id,
    )


def test_approve_document_emits_audit_event(current_user) -> None:
    repository = Mock()
    audit_service = Mock()
    service = DocumentService(repository=repository, audit_service=audit_service)

    response = service.approve_document(21, current_user)

    assert isinstance(response, MessageResponse)
    assert "approve" in response.message.lower()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.APPROVED,
        document_id=21,
        user_id=current_user.user_id,
    )


def test_list_documents_delegates_to_repository(fake_document) -> None:
    repository = Mock()
    repository.list_documents.return_value = [fake_document]
    service = DocumentService(repository=repository, audit_service=Mock())

    result = service.list_documents()

    assert result == [fake_document]
    repository.list_documents.assert_called_once_with()


def test_get_document_delegates_to_repository(fake_document) -> None:
    repository = Mock()
    repository.get_document_by_id.return_value = fake_document
    service = DocumentService(repository=repository, audit_service=Mock())

    result = service.get_document(1)

    assert result == fake_document
    repository.get_document_by_id.assert_called_once_with(1)
