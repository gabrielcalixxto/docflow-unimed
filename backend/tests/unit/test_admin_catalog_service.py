from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.schemas.admin_catalog import AdminCompanyCreate, AdminDocumentTypeCreate, AdminSectorCreate
from app.schemas.common import MessageResponse
from app.services.admin_catalog_service import AdminCatalogService
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


def build_service(*, repository: Mock | None = None) -> AdminCatalogService:
    catalog_repository = repository or Mock()
    catalog_repository.db = catalog_repository.db if hasattr(catalog_repository, "db") else Mock()
    return AdminCatalogService(repository=catalog_repository)


def admin_user() -> AuthenticatedUser:
    return AuthenticatedUser(email="admin@docflow.local", role=UserRole.ADMIN, user_id=1)


def reviewer_user() -> AuthenticatedUser:
    return AuthenticatedUser(email="autor@docflow.local", role=UserRole.AUTOR, user_id=10)


def test_get_options_returns_companies_sectors_and_document_types() -> None:
    repository = Mock()
    repository.list_companies.return_value = [SimpleNamespace(id=1, name="DocFlow Unimed")]
    repository.list_sectors.return_value = [SimpleNamespace(id=10, name="Qualidade", company_id=1)]
    repository.list_document_types.return_value = [
        SimpleNamespace(id=100, sigla="POP", name="Procedimento Operacional Padrao")
    ]
    service = build_service(repository=repository)

    response = service.get_options(admin_user())

    assert response.companies[0].id == 1
    assert response.sectors[0].id == 10
    assert response.document_types[0].sigla == "POP"
    assert response.document_types[0].name == "Procedimento Operacional Padrao"


def test_get_options_blocks_non_admin() -> None:
    repository = Mock()
    service = build_service(repository=repository)

    with pytest.raises(ForbiddenServiceError):
        service.get_options(reviewer_user())


def test_create_company_persists_normalized_name() -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_name.return_value = None
    repository.create_company.return_value = SimpleNamespace(id=3)
    service = build_service(repository=repository)

    response = service.create_company(AdminCompanyCreate(name="  Unimed Campinas  "), admin_user())

    assert isinstance(response, MessageResponse)
    repository.create_company.assert_called_once_with("Unimed Campinas")
    repository.db.commit.assert_called_once_with()


def test_create_company_normalizes_title_case_with_do_de_da() -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_name.return_value = None
    repository.create_company.return_value = SimpleNamespace(id=4)
    service = build_service(repository=repository)

    response = service.create_company(
        AdminCompanyCreate(name="  hospital da mulher de campinas  "),
        admin_user(),
    )

    assert isinstance(response, MessageResponse)
    repository.create_company.assert_called_once_with("Hospital da Mulher de Campinas")
    repository.db.commit.assert_called_once_with()


def test_create_company_blocks_duplicate_name() -> None:
    repository = Mock()
    repository.get_company_by_name.return_value = SimpleNamespace(id=1)
    service = build_service(repository=repository)

    with pytest.raises(ConflictServiceError):
        service.create_company(AdminCompanyCreate(name="DocFlow Unimed"), admin_user())


def test_create_sector_requires_existing_company() -> None:
    repository = Mock()
    repository.get_company_by_id.return_value = None
    service = build_service(repository=repository)

    with pytest.raises(NotFoundServiceError):
        service.create_sector(AdminSectorCreate(name="Nutricao", company_id=99), admin_user())


def test_create_sector_normalizes_title_case_with_do_de_da() -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_company_by_id.return_value = SimpleNamespace(id=1, name="Hospital")
    repository.get_sector_by_name_and_company.return_value = None
    repository.create_sector.return_value = SimpleNamespace(id=11)
    service = build_service(repository=repository)

    response = service.create_sector(
        AdminSectorCreate(name="  farmacia do centro cirurgico  ", company_id=1),
        admin_user(),
    )

    assert isinstance(response, MessageResponse)
    repository.create_sector.assert_called_once_with(
        name="Farmacia do Centro Cirurgico",
        company_id=1,
    )
    repository.db.commit.assert_called_once_with()


def test_delete_sector_blocks_when_it_has_dependencies() -> None:
    repository = Mock()
    repository.get_sector_by_id.return_value = SimpleNamespace(id=10, name="Qualidade")
    repository.count_sector_users.return_value = 1
    repository.count_sector_documents.return_value = 0
    service = build_service(repository=repository)

    with pytest.raises(ConflictServiceError):
        service.delete_sector(10, admin_user())


def test_create_document_type_normalizes_sigla_and_name() -> None:
    repository = Mock()
    repository.db = Mock()
    repository.get_document_type_by_sigla.return_value = None
    repository.get_document_type_by_name.return_value = None
    repository.create_document_type.return_value = SimpleNamespace(id=22, sigla="POP")
    service = build_service(repository=repository)

    response = service.create_document_type(
        AdminDocumentTypeCreate(
            sigla="  p.op  ",
            name="  procedimento operacional padrao  ",
        ),
        admin_user(),
    )

    assert isinstance(response, MessageResponse)
    repository.create_document_type.assert_called_once_with(
        sigla="POP",
        name="Procedimento Operacional Padrao",
    )
    repository.db.commit.assert_called_once_with()


def test_delete_document_type_returns_not_found_for_unknown_id() -> None:
    repository = Mock()
    repository.get_document_type_by_id.return_value = None
    service = build_service(repository=repository)

    with pytest.raises(NotFoundServiceError):
        service.delete_document_type(999, admin_user())
