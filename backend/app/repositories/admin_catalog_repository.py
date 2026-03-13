from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

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

    def create_sector(self, *, name: str, company_id: int) -> Sector:
        sector = Sector(name=name, company_id=company_id)
        self.db.add(sector)
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

    def list_document_types(self) -> list[DocumentType]:
        statement = select(DocumentType).order_by(DocumentType.name.asc())
        return list(self.db.scalars(statement).all())

    def get_document_type_by_id(self, document_type_id: int) -> DocumentType | None:
        statement = select(DocumentType).where(DocumentType.id == document_type_id)
        return self.db.scalar(statement)

    def get_document_type_by_name(self, name: str) -> DocumentType | None:
        statement = select(DocumentType).where(func.lower(DocumentType.name) == name.lower())
        return self.db.scalar(statement)

    def create_document_type(self, name: str) -> DocumentType:
        document_type = DocumentType(name=name)
        self.db.add(document_type)
        self.db.flush()
        return document_type

    def delete_document_type(self, document_type: DocumentType) -> None:
        self.db.delete(document_type)
        self.db.flush()
