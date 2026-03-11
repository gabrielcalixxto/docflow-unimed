from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.schemas.document import DocumentCreate


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_document(self, *, payload: DocumentCreate, created_by: int | None) -> Document:
        document = Document(
            code=payload.code,
            title=payload.title,
            company_id=payload.company_id,
            sector_id=payload.sector_id,
            document_type=payload.document_type,
            scope=payload.scope,
            created_by=created_by,
        )
        self.db.add(document)
        self.db.flush()
        return document

    def list_documents(self) -> list[Document]:
        statement = select(Document).order_by(Document.created_at.desc())
        return list(self.db.scalars(statement).all())

    def get_document_by_id(self, document_id: int) -> Document | None:
        statement = select(Document).where(Document.id == document_id)
        return self.db.scalar(statement)
