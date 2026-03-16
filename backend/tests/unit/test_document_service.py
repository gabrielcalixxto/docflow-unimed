from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.enums import DocumentEventType, DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentDraftUpdate
from app.services.document_service import DocumentService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


def build_author_user() -> AuthenticatedUser:
    return AuthenticatedUser(email="autor@example.com", role=UserRole.AUTOR, user_id=77)


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


def test_create_document_persists_entity_and_emits_event(document_payload) -> None:
    author = build_author_user()
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_id.return_value = SimpleNamespace(id=1)
    repository.get_sector_by_id.return_value = SimpleNamespace(
        id=10,
        name="Qualidade",
        sigla="QUA",
        company_id=1,
    )
    repository.create_document.return_value = SimpleNamespace(id=12, code="PENDING")
    version_repository = Mock()
    version_repository.create_version.return_value = SimpleNamespace(id=24)
    audit_service = Mock()
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        audit_service=audit_service,
    )

    response = service.create_document(document_payload, author)

    assert isinstance(response, MessageResponse)
    assert response.message == "Novo documento criado com sucesso!"
    repository.create_document.assert_called_once_with(
        payload=document_payload,
        code="PENDING",
        created_by=author.user_id,
    )
    assert repository.create_document.return_value.code == "POP-QUA-12"
    version_repository.create_version.assert_called_once()
    version_payload = version_repository.create_version.call_args.kwargs["payload"]
    assert version_payload.version_number == 1
    assert version_payload.status == DocumentStatus.RASCUNHO
    assert version_payload.file_path == document_payload.file_path
    assert version_payload.expiration_date == document_payload.expiration_date
    assert audit_service.create_placeholder_event.call_count == 2
    audit_service.create_placeholder_event.assert_any_call(
        event_type=DocumentEventType.DOCUMENT_CREATED,
        document_id=12,
        user_id=author.user_id,
    )
    audit_service.create_placeholder_event.assert_any_call(
        event_type=DocumentEventType.VERSION_CREATED,
        document_id=12,
        version_id=24,
        user_id=author.user_id,
    )
    repository.db.commit.assert_called_once_with()


def test_create_document_raises_not_found_when_company_does_not_exist(document_payload) -> None:
    author = build_author_user()
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_id.return_value = None
    service = build_service(repository=repository)

    with pytest.raises(NotFoundServiceError):
        service.create_document(document_payload, author)


def test_create_document_raises_conflict_when_sector_company_do_not_match(
    document_payload
) -> None:
    author = build_author_user()
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_id.return_value = SimpleNamespace(id=1)
    repository.get_sector_by_id.return_value = SimpleNamespace(id=10, name="Qualidade", company_id=2)
    service = build_service(repository=repository)

    with pytest.raises(ConflictServiceError):
        service.create_document(document_payload, author)


def test_create_document_blocks_reader_role(document_payload) -> None:
    repository = Mock()
    repository.db = Mock()
    service = build_service(repository=repository)
    reader = AuthenticatedUser(email="reader@example.com", role=UserRole.LEITOR, user_id=9)

    with pytest.raises(ForbiddenServiceError):
        service.create_document(document_payload, reader)


def test_submit_for_review_moves_latest_draft_to_quality_queue() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
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

    response = service.submit_for_review(12, coordinator)

    assert isinstance(response, MessageResponse)
    assert latest_version.status == DocumentStatus.PENDENTE_QUALIDADE
    version_repository.save.assert_called_once_with(latest_version)
    repository.db.commit.assert_called_once_with()
    audit_service.create_placeholder_event.assert_called_once_with(
        event_type=DocumentEventType.SUBMITTED_FOR_REVIEW,
        document_id=12,
        version_id=31,
        user_id=coordinator.user_id,
    )
    assert "quality" in response.message.lower()


def test_submit_for_review_raises_not_found_when_document_missing() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = None
    service = build_service(repository=repository)

    with pytest.raises(NotFoundServiceError):
        service.submit_for_review(999, coordinator)


def test_submit_for_review_blocks_non_coordinator_role() -> None:
    repository = Mock()
    repository.db = Mock()
    service = build_service(repository=repository)
    reviewer = AuthenticatedUser(email="revisor@example.com", role=UserRole.REVISOR, user_id=7)

    with pytest.raises(ForbiddenServiceError):
        service.submit_for_review(10, reviewer)


def test_submit_for_review_raises_conflict_on_invalid_status() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=12, sector_id=10)
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=31,
        status=DocumentStatus.PENDENTE_QUALIDADE,
    )
    service = build_service(repository=repository, version_repository=version_repository)

    with pytest.raises(ConflictServiceError):
        service.submit_for_review(12, coordinator)


def test_approve_document_by_coordinator_moves_draft_to_quality() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    draft_version = SimpleNamespace(
        id=101,
        status=DocumentStatus.RASCUNHO,
        approved_by=None,
        approved_at=None,
    )
    version_repository.get_latest_version_for_document.return_value = draft_version
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
    assert draft_version.status == DocumentStatus.PENDENTE_QUALIDADE
    assert draft_version.approved_by is None
    assert draft_version.approved_at is None
    version_repository.save.assert_called_once_with(draft_version)
    repository.db.commit.assert_called_once_with()
    assert audit_service.create_placeholder_event.call_count == 1
    assert "approved" in response.message.lower()


def test_approve_document_by_quality_promotes_to_vigente_and_obsoletes_previous_active() -> None:
    reviewer = AuthenticatedUser(email="qualidade@example.com", role=UserRole.REVISOR, user_id=8)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_in_review = SimpleNamespace(
        id=101,
        status=DocumentStatus.PENDENTE_QUALIDADE,
        approved_by=None,
        approved_at=None,
        invalidated_at=None,
        invalidated_by=None,
    )
    previous_active = SimpleNamespace(id=100, status=DocumentStatus.VIGENTE)
    version_repository.get_latest_version_for_document.return_value = version_in_review
    version_repository.get_active_version_for_document.return_value = previous_active
    auth_repository = Mock()
    auth_repository.get_user_by_id.return_value = SimpleNamespace(id=8, sector_id=10)
    audit_service = Mock()
    service = build_service(
        repository=repository,
        version_repository=version_repository,
        auth_repository=auth_repository,
        audit_service=audit_service,
    )

    response = service.approve_document(55, reviewer)

    assert isinstance(response, MessageResponse)
    assert version_in_review.status == DocumentStatus.VIGENTE
    assert version_in_review.approved_by == 8
    assert version_in_review.approved_at is not None
    assert previous_active.status == DocumentStatus.OBSOLETO
    assert version_repository.save.call_count == 2
    repository.db.commit.assert_called_once_with()
    assert audit_service.create_placeholder_event.call_count == 3
    assert "quality" in response.message.lower()


def test_approve_document_blocks_non_coordinator_for_draft(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=21, sector_id=10)
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=101,
        status=DocumentStatus.RASCUNHO,
    )
    service = build_service(repository=repository, version_repository=version_repository)

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
        status=DocumentStatus.RASCUNHO,
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
        status=DocumentStatus.VIGENTE,
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


def test_reject_document_by_reviewer_moves_status_to_revisar_rascunho() -> None:
    coordinator = AuthenticatedUser(email="coord@example.com", role=UserRole.COORDENADOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_in_review = SimpleNamespace(
        id=101,
        status=DocumentStatus.RASCUNHO,
        approved_by=None,
        approved_at=None,
        invalidated_at=None,
        invalidated_by=None,
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
    assert version_in_review.status == DocumentStatus.REVISAR_RASCUNHO
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


def test_reject_document_by_quality_sets_status_to_reprovado() -> None:
    reviewer = AuthenticatedUser(email="qualidade@example.com", role=UserRole.REVISOR, user_id=7)
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(id=55, sector_id=10)
    version_repository = Mock()
    version_in_review = SimpleNamespace(
        id=101,
        status=DocumentStatus.PENDENTE_QUALIDADE,
        approved_by=7,
        approved_at=object(),
        invalidated_at=None,
        invalidated_by=None,
    )
    version_repository.get_latest_version_for_document.return_value = version_in_review
    service = build_service(
        repository=repository,
        version_repository=version_repository,
    )

    response = service.reject_document(55, reviewer)

    assert isinstance(response, MessageResponse)
    assert version_in_review.status == DocumentStatus.REPROVADO
    assert version_in_review.approved_by is None
    assert version_in_review.approved_at is None


def test_reject_document_blocks_user_without_reviewer_or_coordinator_role() -> None:
    author = AuthenticatedUser(email="autor@example.com", role=UserRole.AUTOR, user_id=33)
    repository = Mock()
    repository.db = Mock()
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=101,
        status=DocumentStatus.RASCUNHO,
    )
    service = build_service(repository=repository, version_repository=version_repository)

    with pytest.raises(ForbiddenServiceError):
        service.reject_document(21, author)


def test_reject_document_raises_conflict_when_latest_not_rejectable(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=101,
        status=DocumentStatus.VIGENTE,
    )
    service = build_service(repository=repository, version_repository=version_repository)

    with pytest.raises(ConflictServiceError):
        service.reject_document(55, current_user)


def test_list_documents_delegates_to_repository(fake_document, current_user) -> None:
    repository = Mock()
    repository.list_documents.return_value = [fake_document]
    service = build_service(repository=repository)

    result = service.list_documents(current_user)

    assert result == [fake_document]
    repository.list_documents.assert_called_once_with()


def test_get_document_delegates_to_repository(fake_document, current_user) -> None:
    repository = Mock()
    repository.get_document_by_id.return_value = fake_document
    service = build_service(repository=repository)

    result = service.get_document(1, current_user)

    assert result == fake_document
    repository.get_document_by_id.assert_called_once_with(1)


def test_get_form_options_returns_companies_sectors_types_and_scopes() -> None:
    repository = Mock()
    repository.list_companies.return_value = [SimpleNamespace(id=1, name="DocFlow Unimed")]
    repository.list_sectors.return_value = [SimpleNamespace(id=10, name="Qualidade", sigla="QLD", company_id=1)]
    repository.list_document_types.return_value = [
        SimpleNamespace(id=1, sigla="POP", name="Procedimento Operacional Padrao"),
        SimpleNamespace(id=2, sigla="it", name="Instrucao de Trabalho"),
    ]
    repository.list_distinct_document_types.return_value = ["Pop", "manual", "instrucao"]
    service = build_service(repository=repository)

    options = service.get_form_options()

    assert options.companies[0].id == 1
    assert options.sectors[0].id == 10
    assert "POP" in options.document_types
    assert "MANUAL" in options.document_types
    assert "INSTRUCAO" in options.document_types
    assert options.document_type_options[0].sigla == "POP"
    assert options.document_type_options[0].name == "Procedimento Operacional Padrao"
    assert any(item.sigla == "MANUAL" and item.name == "MANUAL" for item in options.document_type_options)
    assert options.scopes == list(DocumentScope)


def test_update_draft_document_updates_document_and_latest_version(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(
        id=12,
        created_by=current_user.user_id,
        title="Titulo antigo",
    )
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=31,
        status=DocumentStatus.RASCUNHO,
        file_path="/tmp/old.pdf",
        expiration_date=date(2027, 1, 31),
    )
    service = build_service(repository=repository, version_repository=version_repository)

    response = service.update_draft_document(
        12,
        DocumentDraftUpdate(
            title="Titulo novo",
            file_path="/tmp/new.pdf",
            expiration_date=date(2028, 1, 31),
        ),
        current_user,
    )

    assert isinstance(response, MessageResponse)
    assert "updated" in response.message.lower()
    repository.save.assert_called_once()
    version_repository.save.assert_called_once()
    repository.db.commit.assert_called_once_with()


def test_update_draft_document_blocks_non_requester(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(
        id=12,
        created_by=777,
        title="Titulo antigo",
    )
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=31,
        status=DocumentStatus.RASCUNHO,
    )
    service = build_service(repository=repository, version_repository=version_repository)

    with pytest.raises(ForbiddenServiceError):
        service.update_draft_document(12, DocumentDraftUpdate(title="Novo"), current_user)


def test_delete_draft_document_deletes_document_for_requester(current_user) -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_by_id.return_value = SimpleNamespace(
        id=12,
        created_by=current_user.user_id,
        title="Titulo antigo",
    )
    version_repository = Mock()
    version_repository.get_latest_version_for_document.return_value = SimpleNamespace(
        id=31,
        status=DocumentStatus.RASCUNHO,
    )
    service = build_service(repository=repository, version_repository=version_repository)

    response = service.delete_draft_document(12, current_user)

    assert isinstance(response, MessageResponse)
    assert "deleted" in response.message.lower()
    repository.delete.assert_called_once()
    repository.db.commit.assert_called_once_with()
