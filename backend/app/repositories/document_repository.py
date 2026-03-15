from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.document import Document
from app.models.document_type import DocumentType
from app.models.sector import Sector
from app.schemas.document import DocumentCreate


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_document(self, *, payload: DocumentCreate, code: str, created_by: int | None) -> Document:
        document = Document(
            code=code,
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
        statement = select(Document).options(joinedload(Document.creator)).order_by(Document.created_at.desc())
        return list(self.db.scalars(statement).all())

    def get_document_by_id(self, document_id: int) -> Document | None:
        statement = select(Document).options(joinedload(Document.creator)).where(Document.id == document_id)
        return self.db.scalar(statement)

    def save(self, document: Document) -> None:
        self.db.add(document)
        self.db.flush()

    def delete(self, document: Document) -> None:
        self.db.delete(document)
        self.db.flush()

    def get_company_by_id(self, company_id: int) -> Company | None:
        statement = select(Company).where(Company.id == company_id)
        return self.db.scalar(statement)

    def get_sector_by_id(self, sector_id: int) -> Sector | None:
        statement = select(Sector).where(Sector.id == sector_id)
        return self.db.scalar(statement)

    def list_companies(self) -> list[Company]:
        statement = select(Company).order_by(Company.name.asc())
        return list(self.db.scalars(statement).all())

    def list_sectors(self) -> list[Sector]:
        statement = select(Sector).order_by(Sector.name.asc())
        return list(self.db.scalars(statement).all())

    def list_distinct_document_types(self) -> list[str]:
        statement = (
            select(Document.document_type)
            .where(Document.document_type.is_not(None), Document.document_type != "")
            .distinct()
            .order_by(Document.document_type.asc())
        )
        return list(self.db.scalars(statement).all())

    def list_document_types(self) -> list[DocumentType]:
        statement = select(DocumentType).order_by(DocumentType.name.asc())
        return list(self.db.scalars(statement).all())
