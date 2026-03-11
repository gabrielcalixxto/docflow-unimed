from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_documents(self) -> list[Document]:
        statement = select(Document).order_by(Document.created_at.desc())
        return list(self.db.scalars(statement).all())

    def get_document_by_id(self, document_id: int) -> Document | None:
        statement = select(Document).where(Document.id == document_id)
        return self.db.scalar(statement)
