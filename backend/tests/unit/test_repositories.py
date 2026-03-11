from unittest.mock import Mock

from app.core.enums import DocumentStatus
from app.repositories.document_repository import DocumentRepository
from app.repositories.search_repository import SearchRepository
from app.repositories.version_repository import VersionRepository


def test_document_repository_list_documents_orders_by_created_at_desc() -> None:
    db = Mock()
    db.scalars.return_value.all.return_value = []
    repository = DocumentRepository(db)

    repository.list_documents()

    statement = db.scalars.call_args.args[0]
    assert "order by documents.created_at desc" in str(statement).lower()


def test_document_repository_get_document_by_id_filters_by_id() -> None:
    db = Mock()
    repository = DocumentRepository(db)

    repository.get_document_by_id(123)

    statement = db.scalar.call_args.args[0]
    compiled = statement.compile()
    assert 123 in compiled.params.values()


def test_version_repository_list_versions_filters_document_and_orders_desc() -> None:
    db = Mock()
    db.scalars.return_value.all.return_value = []
    repository = VersionRepository(db)

    repository.list_versions_for_document(7)

    statement = db.scalars.call_args.args[0]
    compiled = statement.compile()
    sql = str(statement).lower()
    assert "where document_versions.document_id =" in sql
    assert "order by document_versions.version_number desc" in sql
    assert 7 in compiled.params.values()


def test_search_repository_filters_only_vigente_versions() -> None:
    db = Mock()
    db.execute.return_value.all.return_value = []
    repository = SearchRepository(db)

    repository.search_active_documents()

    statement = db.execute.call_args.args[0]
    compiled = statement.compile()
    assert DocumentStatus.VIGENTE in compiled.params.values()


def test_search_repository_maps_rows_as_document_version_tuples() -> None:
    document = Mock()
    version = Mock()
    db = Mock()
    db.execute.return_value.all.return_value = [(document, version)]
    repository = SearchRepository(db)

    rows = repository.search_active_documents()

    assert rows == [(document, version)]
