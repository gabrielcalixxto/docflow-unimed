from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.enums import DocumentEventType, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.schemas.common import MessageResponse
from app.services.document_service import DocumentService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


def build_service(
    *,
    repository: Mock | None = None,
    version_repository: Mock | None = None,
    auth_repository: Mock | None = None,
    audit_service: Mock | None = None,
) -> DocumentService:
    document_repository = repository or Mock()
    document_repository.db = document_repository.db if hasattr(document_repository, "db") else Mock()
    versions = version_repository or Mock()
    users = auth_repository or Mock()
    audit = audit_service or Mock()
    return DocumentService(
        repository=document_repository,
        version_repository=versions,
        auth_repository=users,
        audit_service=audit,
    )


def test_create_document_persists_entity_and_emits_event(document_payload, current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.create_document.return_value = SimpleNamespace(id=12)
    audit_service = Mock()
    service = build_service(repository=repository, audit_service=audit_service)

    response = service.create_document(document_payload, current_user)

    assert isinstance(response, MessageResponse)
    assert "created" in response.message.lower()
    repository.create_document.assert_called_once_with(payload=document_payload, created_by=current_user.user_id)
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.DOCUMENT_CREATED,
        document_id=12,
        user_id=current_user.user_id,
    )
    repository.db.commit.assert_called_once_with()


def test_create_document_blocks_reader_role(document_payload) -> None:
    repository = Mock()
    repository.db = Mock()
    service = build_service(repository=repository)
    reader = AuthenticatedUser(email="reader@example.com", role=UserRole.LEITOR, user_id=9)

    with pytest.raises(ForbiddenServiceError):
        service.create_document(document_payload, reader)


def test_submit_for_review_moves_latest_draft_to_review(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=12, sector_id=10)
    version_repository = Mock()
    latest_version = SimpleNamespace(id=31, status=DocumentStatus.RASCUNHO)
    version_repository.get_latest_version_for_document.return_value = latest_version
    audit_service = Mock()
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        audit_service=audit_service,
    )

    response = service.submit_for_review(12, current_user)

    assert isinstance(response, MessageResponse)
    assert latest_version.status == DocumentStatus.EM_REVISAO
    version_repository.save.assert_called_once_with(latest_version)
    repository.db.commit.assert_called_once_with()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.SUBMITTED_FOR_REVIEW,
        document_id=12,
        version_id=31,
        user_id=current_user.user_id,
    )
    assert "submitted" in response.message.lower()


def test_submit_for_review_raises_not_found_when_document_missing(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = None
    service = build_service(repository=repository)

    with pytest.raises(NotFoundServiceError):
        service.submit_for_review(999, current_user)


def test_submit_for_review_raises_conflict_on_invalid_status(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=12, sector_id=10)
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=31,
        status=DocumentStatus.EM_REVISAO,
    )
    service = build_service(repository=repository, version_repository=version_repository)

    with pytest.raises(ConflictServiceError):
        service.submit_for_review(12, current_user)


def test_approve_document_promotes_review_and_obsoletes_previous_active() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_in_review = SimpleNamespace(
        id=101,
        status=DocumentStatus.EM_REVISAO,
        approved_by=None,
        approved_at=None,
    )
    previous_active = SimpleNamespace(id=100, status=DocumentStatus.VIGENTE)
    version_repository.get_latest_version_for_document.return_value = version_in_review
    version_repository.get_active_version_for_document.return_value = previous_active
    auth_repository = Mock()
    auth_repository.get_user_by_id.return_value = SimpleNamespace(id=7, sector_id=10)
    audit_service = Mock()
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        auth_repository=auth_repository,
        audit_service=audit_service,
    )

    response = service.approve_document(55, coordinator)

    assert isinstance(response, MessageResponse)
    assert version_in_review.status == DocumentStatus.VIGENTE
    assert version_in_review.approved_by == 7
    assert version_in_review.approved_at is not None
    assert previous_active.status == DocumentStatus.OBSOLETO
    assert version_repository.save.call_count == 2
    repository.db.commit.assert_called_once_with()
    assert audit_service.create_placeholder_event.call_count == 3
    assert "approved" in response.message.lower()


def test_approve_document_blocks_non_coordinator(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    service = build_service(repository=repository)

    with pytest.raises(ForbiddenServiceError):
        service.approve_document(21, current_user)


def test_approve_document_blocks_coordinator_from_other_sector() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=101,
        status=DocumentStatus.EM_REVISAO,
    )
    auth_repository = Mock()
    auth_repository.get_user_by_id.return_value = SimpleNamespace(id=7, sector_id=99)
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        auth_repository=auth_repository,
    )

    with pytest.raises(ForbiddenServiceError):
        service.approve_document(55, coordinator)


def test_approve_document_raises_conflict_when_latest_not_in_review() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=101,
        status=DocumentStatus.RASCUNHO,
    )
    auth_repository = Mock()
    auth_repository.get_user_by_id.return_value = SimpleNamespace(id=7, sector_id=10)
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        auth_repository=auth_repository,
    )

    with pytest.raises(ConflictServiceError):
        service.approve_document(55, coordinator)


def test_reject_document_returns_review_to_draft_and_emits_event() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_in_review = SimpleNamespace(
        id=101,
        status=DocumentStatus.EM_REVISAO,
        approved_by=7,
        approved_at=object(),
    )
    version_repository.get_latest_version_for_document.return_value = version_in_review
    auth_repository = Mock()
    auth_repository.get_user_by_id.return_value = SimpleNamespace(id=7, sector_id=10)
    audit_service = Mock()
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        auth_repository=auth_repository,
        audit_service=audit_service,
    )

    response = service.reject_document(55, coordinator, reason="ajustar texto")

    assert isinstance(response, MessageResponse)
    assert version_in_review.status == DocumentStatus.RASCUNHO
    assert version_in_review.approved_by is None
    assert version_in_review.approved_at is None
    version_repository.save.assert_called_once_with(version_in_review)
    repository.db.commit.assert_called_once_with()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.REJECTED,
        document_id=55,
        version_id=101,
        user_id=7,
    )
    assert "rejected" in response.message.lower()


def test_reject_document_blocks_non_coordinator(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    service = build_service(repository=repository)

    with pytest.raises(ForbiddenServiceError):
        service.reject_document(21, current_user)


def test_reject_document_raises_conflict_when_latest_not_in_review() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=101,
        status=DocumentStatus.RASCUNHO,
    )
    auth_repository = Mock()
    auth_repository.get_user_by_id.return_value = SimpleNamespace(id=7, sector_id=10)
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        auth_repository=auth_repository,
    )

    with pytest.raises(ConflictServiceError):
        service.reject_document(55, coordinator)


def test_list_documents_delegates_to_repository(fake_document) -> None:
    repository = Mock()
    repository.list_documents.return_value = [fake_document]
    service = build_service(repository=repository)

    result = service.list_documents()

    assert result == [fake_document]
    repository.list_documents.assert_called_once_with()


def test_get_document_delegates_to_repository(fake_document) -> None:
    repository = Mock()
    repository.get_document_by_id.return_value = fake_document
    service = build_service(repository=repository)

    result = service.get_document(1)

    assert result == fake_document
    repository.get_document_by_id.assert_called_once_with(1)
