from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.enums import UserRole
from app.models.company import Company
from app.models.document_type import DocumentType
from app.models.sector import Sector
from app.core.security import hash_password
from app.models.user import User

_DEFAULT_COMPANY_NAME = "DocFlow Unimed"
_DEFAULT_SECTORS = ["Qualidade", "Nutricao", "Enfermagem"]
_DEFAULT_DOCUMENT_TYPES = ["POP", "IT", "MANUAL", "POLITICA", "PROTOCOLO"]

_DEFAULT_USERS: list[tuple[str, str, UserRole, str | None]] = [
    ("Admin DocFlow", "admin@teste.com", UserRole.ADMIN, None),
    ("Autor DocFlow", "autor@teste.com", UserRole.AUTOR, "Qualidade"),
    ("Revisor DocFlow", "revisor@teste.com", UserRole.REVISOR, "Qualidade"),
    ("Coordenacao Qualidade", "coord@teste.com", UserRole.COORDENADOR, "Qualidade"),
    ("Leitor DocFlow", "leitor@teste.com", UserRole.LEITOR, "Qualidade"),
]


def seed_default_users() -> None:
    if not settings.seed_default_users:
        return

    db = SessionLocal()
    try:
        created_or_updated = False
        password_hash = hash_password(settings.seed_default_password)

        company_statement = select(Company).where(Company.name == _DEFAULT_COMPANY_NAME)
        company = db.scalar(company_statement)
        if company is None:
            company = Company(name=_DEFAULT_COMPANY_NAME)
            db.add(company)
            db.flush()
            created_or_updated = True

        sectors_by_name: dict[str, Sector] = {}
        for sector_name in _DEFAULT_SECTORS:
            sector_statement = select(Sector).where(
                Sector.name == sector_name,
                Sector.company_id == company.id,
            )
            sector = db.scalar(sector_statement)
            if sector is None:
                sector = Sector(name=sector_name, company_id=company.id)
                db.add(sector)
                db.flush()
                created_or_updated = True
            sectors_by_name[sector_name] = sector

        for document_type_name in _DEFAULT_DOCUMENT_TYPES:
            document_type_statement = select(DocumentType).where(DocumentType.name == document_type_name)
            document_type = db.scalar(document_type_statement)
            if document_type is None:
                db.add(DocumentType(name=document_type_name))
                created_or_updated = True

        for name, email, role, sector_name in _DEFAULT_USERS:
            sector_id = sectors_by_name[sector_name].id if sector_name is not None else None
            statement = select(User).where(User.email == email)
            user = db.scalar(statement)
            if user is None:
                db.add(
                    User(
                        name=name,
                        email=email,
                        password_hash=password_hash,
                        role=role,
                        sector_id=sector_id,
                    )
                )
                created_or_updated = True
                continue

            user_updated = False
            if user.name != name:
                user.name = name
                user_updated = True
            if user.role != role:
                user.role = role
                user_updated = True
            if user.sector_id != sector_id:
                user.sector_id = sector_id
                user_updated = True

            if user_updated:
                db.add(user)
                created_or_updated = True

        if created_or_updated:
            db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        db.close()
