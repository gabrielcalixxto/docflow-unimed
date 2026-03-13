from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.core.enums import DocumentScope, DocumentStatus
from app.schemas.document import DocumentCreate, DocumentDraftUpdate
from app.schemas.version import DocumentVersionCreate


def test_document_create_rejects_past_expiration_date() -> None:
    with pytest.raises(ValidationError):
        DocumentCreate(
            title="Manual de Teste",
            company_id=1,
            sector_id=1,
            document_type="POP",
            scope=DocumentScope.LOCAL,
            file_path="/tmp/teste.pdf",
            expiration_date=date.today() - timedelta(days=1),
        )


def test_document_create_accepts_today_expiration_date() -> None:
    payload = DocumentCreate(
        title="Manual de Teste",
        company_id=1,
        sector_id=1,
        document_type="POP",
        scope=DocumentScope.LOCAL,
        file_path="/tmp/teste.pdf",
        expiration_date=date.today(),
    )
    assert payload.expiration_date == date.today()


def test_document_version_create_rejects_past_expiration_date() -> None:
    with pytest.raises(ValidationError):
        DocumentVersionCreate(
            version_number=2,
            status=DocumentStatus.RASCUNHO,
            file_path="/tmp/teste-v2.pdf",
            expiration_date=date.today() - timedelta(days=1),
        )


def test_document_draft_update_rejects_past_expiration_date() -> None:
    with pytest.raises(ValidationError):
        DocumentDraftUpdate(
            title="Titulo ajustado",
            file_path="/tmp/teste-ajuste.pdf",
            expiration_date=date.today() - timedelta(days=1),
        )


def test_document_draft_update_accepts_today_expiration_date() -> None:
    payload = DocumentDraftUpdate(
        title="Titulo ajustado",
        file_path="/tmp/teste-ajuste.pdf",
        expiration_date=date.today(),
    )
    assert payload.expiration_date == date.today()
