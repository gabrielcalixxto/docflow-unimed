from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

from app.core.enums import DocumentScope
from app.services.search_service import SearchService


def test_search_documents_maps_document_and_active_version_rows() -> None:
    repository = Mock()
    repository.search_active_documents.return_value = [
        (
            SimpleNamespace(
                id=1,
                code="DOC-001",
                title="Manual de Nutricao",
                document_type="POP",
                scope=DocumentScope.LOCAL,
            ),
            SimpleNamespace(
                id=11,
                version_number=2,
                file_path="/tmp/doc-001-v2.pdf",
                expiration_date=date(2027, 1, 31),
            ),
        )
    ]

    service = SearchService(repository=repository)
    response = service.search_documents()

    assert len(response.items) == 1
    item = response.items[0]
    assert item.document_id == 1
    assert item.active_version_id == 11
    assert item.scope == DocumentScope.LOCAL
    repository.search_active_documents.assert_called_once_with()
