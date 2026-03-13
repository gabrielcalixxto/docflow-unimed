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

_DEFAULT_USERS: list[tuple[str, str, str, list[UserRole], list[str], list[str]]] = [
    ("Admin DocFlow", "admin.docflow", "admin@teste.com", [UserRole.ADMIN], [], []),
    ("Autor DocFlow", "autor.docflow", "autor@teste.com", [UserRole.AUTOR], [_DEFAULT_COMPANY_NAME], ["Qualidade"]),
    ("Revisor DocFlow", "revisor.docflow", "revisor@teste.com", [UserRole.REVISOR], [_DEFAULT_COMPANY_NAME], ["Qualidade"]),
    (
        "Coordenacao Qualidade",
        "coordenacao.qualidade",
        "coord@teste.com",
        [UserRole.COORDENADOR],
        [_DEFAULT_COMPANY_NAME],
        ["Qualidade"],
    ),
    ("Leitor DocFlow", "leitor.docflow", "leitor@teste.com", [UserRole.LEITOR], [_DEFAULT_COMPANY_NAME], ["Qualidade"]),
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

        companies_by_name = {_DEFAULT_COMPANY_NAME: company}

        for name, username, email, roles, company_names, sector_names in _DEFAULT_USERS:
            company_ids = [companies_by_name[company_name].id for company_name in company_names]
            company_id = company_ids[0] if company_ids else None
            sector_ids = [sectors_by_name[sector_name].id for sector_name in sector_names]
            sector_id = sector_ids[0] if sector_ids else None
            primary_role = roles[0]
            statement = select(User).where(User.email == email)
            user = db.scalar(statement)
            if user is None:
                db.add(
                    User(
                        name=name,
                        username=username,
                        email=email,
                        password_hash=password_hash,
                        role=primary_role,
                        roles=[role.value for role in roles],
                        company_id=company_id,
                        company_ids=company_ids,
                        sector_id=sector_id,
                        sector_ids=sector_ids,
                    )
                )
                created_or_updated = True
                continue

            user_updated = False
            if user.name != name:
                user.name = name
                user_updated = True
            if user.username != username:
                user.username = username
                user_updated = True
            if user.role != primary_role:
                user.role = primary_role
                user_updated = True
            normalized_roles = [role.value for role in roles]
            if (user.roles or []) != normalized_roles:
                user.roles = normalized_roles
                user_updated = True
            if user.company_id != company_id:
                user.company_id = company_id
                user_updated = True
            if (user.company_ids or []) != company_ids:
                user.company_ids = company_ids
                user_updated = True
            if user.sector_id != sector_id:
                user.sector_id = sector_id
                user_updated = True
            if (user.sector_ids or []) != sector_ids:
                user.sector_ids = sector_ids
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
