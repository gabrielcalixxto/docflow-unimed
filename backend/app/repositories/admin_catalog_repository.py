from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company
from app.models.document import Document
from app.models.document_type import DocumentType
from app.models.sector import Sector
from app.models.user import User


class AdminCatalogRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_companies(self) -> list[Company]:
        statement = select(Company).order_by(Company.name.asc())
        return list(self.db.scalars(statement).all())

    def get_company_by_id(self, company_id: int) -> Company | None:
        statement = select(Company).where(Company.id == company_id)
        return self.db.scalar(statement)

    def get_company_by_name(self, name: str) -> Company | None:
        statement = select(Company).where(func.lower(Company.name) == name.lower())
        return self.db.scalar(statement)

    def create_company(self, name: str) -> Company:
        company = Company(name=name)
        self.db.add(company)
        self.db.flush()
        return company

    def update_company(self, company: Company, *, name: str) -> Company:
        company.name = name
        self.db.flush()
        return company

    def delete_company(self, company: Company) -> None:
        self.db.delete(company)
        self.db.flush()

    def count_company_sectors(self, company_id: int) -> int:
        statement = select(func.count()).select_from(Sector).where(Sector.company_id == company_id)
        return int(self.db.scalar(statement) or 0)

    def count_company_documents(self, company_id: int) -> int:
        statement = select(func.count()).select_from(Document).where(Document.company_id == company_id)
        return int(self.db.scalar(statement) or 0)

    def count_company_users(self, company_id: int) -> int:
        statement = select(func.count()).select_from(User).where(
            or_(
                User.company_id == company_id,
                User.company_ids.contains([company_id]),
            )
        )
        return int(self.db.scalar(statement) or 0)

    def list_sectors(self) -> list[Sector]:
        statement = select(Sector).order_by(Sector.name.asc())
        return list(self.db.scalars(statement).all())

    def get_sector_by_id(self, sector_id: int) -> Sector | None:
        statement = select(Sector).where(Sector.id == sector_id)
        return self.db.scalar(statement)

    def get_sector_by_name_and_company(self, name: str, company_id: int) -> Sector | None:
        statement = select(Sector).where(
            func.lower(Sector.name) == name.lower(),
            Sector.company_id == company_id,
        )
        return self.db.scalar(statement)

    def get_sector_by_sigla_and_company(self, sigla: str, company_id: int) -> Sector | None:
        statement = select(Sector).where(
            func.lower(Sector.sigla) == sigla.lower(),
            Sector.company_id == company_id,
        )
        return self.db.scalar(statement)

    def create_sector(self, *, name: str, sigla: str, company_id: int) -> Sector:
        sector = Sector(name=name, sigla=sigla, company_id=company_id)
        self.db.add(sector)
        self.db.flush()
        return sector

    def update_sector(self, sector: Sector, *, name: str, sigla: str, company_id: int) -> Sector:
        sector.name = name
        sector.sigla = sigla
        sector.company_id = company_id
        self.db.flush()
        return sector

    def delete_sector(self, sector: Sector) -> None:
        self.db.delete(sector)
        self.db.flush()

    def count_sector_users(self, sector_id: int) -> int:
        statement = select(func.count()).select_from(User).where(
            or_(
                User.sector_id == sector_id,
                User.sector_ids.contains([sector_id]),
            )
        )
        return int(self.db.scalar(statement) or 0)

    def count_sector_documents(self, sector_id: int) -> int:
        statement = select(func.count()).select_from(Document).where(Document.sector_id == sector_id)
        return int(self.db.scalar(statement) or 0)

    def remap_documents_company_for_sector(self, *, sector_id: int, target_company_id: int) -> int:
        statement = (
            update(Document)
            .where(Document.sector_id == sector_id)
            .values(company_id=target_company_id)
        )
        result = self.db.execute(statement)
        self.db.flush()
        return int(result.rowcount or 0)

    def list_document_types(self) -> list[DocumentType]:
        statement = select(DocumentType).order_by(DocumentType.sigla.asc(), DocumentType.name.asc())
        return list(self.db.scalars(statement).all())

    def get_document_type_by_id(self, document_type_id: int) -> DocumentType | None:
        statement = select(DocumentType).where(DocumentType.id == document_type_id)
        return self.db.scalar(statement)

    def get_document_type_by_name(self, name: str) -> DocumentType | None:
        statement = select(DocumentType).where(func.lower(DocumentType.name) == name.lower())
        return self.db.scalar(statement)

    def get_document_type_by_sigla(self, sigla: str) -> DocumentType | None:
        statement = select(DocumentType).where(func.lower(DocumentType.sigla) == sigla.lower())
        return self.db.scalar(statement)

    def create_document_type(self, *, sigla: str, name: str) -> DocumentType:
        document_type = DocumentType(sigla=sigla, name=name)
        self.db.add(document_type)
        self.db.flush()
        return document_type

    def update_document_type(self, document_type: DocumentType, *, sigla: str, name: str) -> DocumentType:
        document_type.sigla = sigla
        document_type.name = name
        self.db.flush()
        return document_type

    def remap_documents_document_type(self, *, source_values: set[str], target_sigla: str) -> int:
        normalized_sources = {value.strip().lower() for value in source_values if value and value.strip()}
        if not normalized_sources:
            return 0

        statement = (
            update(Document)
            .where(func.lower(Document.document_type).in_(normalized_sources))
            .values(document_type=target_sigla)
        )
        result = self.db.execute(statement)
        self.db.flush()
        return int(result.rowcount or 0)

    def list_documents_by_sector_id(self, sector_id: int) -> list[Document]:
        statement = (
            select(Document)
            .options(selectinload(Document.sector))
            .where(Document.sector_id == sector_id)
        )
        return list(self.db.scalars(statement).all())

    def list_documents_by_document_type(self, document_type: str) -> list[Document]:
        statement = (
            select(Document)
            .options(selectinload(Document.sector))
            .where(func.lower(Document.document_type) == document_type.lower())
        )
        return list(self.db.scalars(statement).all())

    def save_document(self, document: Document) -> None:
        self.db.add(document)
        self.db.flush()

    def delete_document_type(self, document_type: DocumentType) -> None:
        self.db.delete(document_type)
        self.db.flush()
