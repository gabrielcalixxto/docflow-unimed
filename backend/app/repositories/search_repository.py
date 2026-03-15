from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import DocumentStatus
from app.models.document import Document
from app.models.document_version import DocumentVersion


class SearchRepository:
    def __init__(self, db: Session):
        self.db = db

    def search_active_documents(self) -> list[tuple[Document, DocumentVersion]]:
        statement = (
            select(Document, DocumentVersion)
            .join(DocumentVersion, DocumentVersion.document_id == Document.id)
            .options(joinedload(DocumentVersion.approver))
            .where(DocumentVersion.status == DocumentStatus.VIGENTE)
            .order_by(Document.created_at.desc())
        )
        rows = self.db.execute(statement).all()
        return [(document, version) for document, version in rows]
