from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.sector import Sector
from app.models.user import User
from app.schemas.user_admin import UserAdminCreate


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_users(self) -> list[User]:
        statement = select(User).order_by(User.name.asc(), User.email.asc())
        return list(self.db.scalars(statement).all())

    def get_user_by_id(self, user_id: int) -> User | None:
        statement = select(User).where(User.id == user_id)
        return self.db.scalar(statement)

    def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.db.scalar(statement)

    def get_user_by_username(self, username: str) -> User | None:
        statement = select(User).where(User.username == username)
        return self.db.scalar(statement)

    def list_sectors(self) -> list[Sector]:
        statement = select(Sector).order_by(Sector.name.asc())
        return list(self.db.scalars(statement).all())

    def list_companies(self) -> list[Company]:
        statement = select(Company).order_by(Company.name.asc())
        return list(self.db.scalars(statement).all())

    def get_company_by_id(self, company_id: int) -> Company | None:
        statement = select(Company).where(Company.id == company_id)
        return self.db.scalar(statement)

    def get_sector_by_id(self, sector_id: int) -> Sector | None:
        statement = select(Sector).where(Sector.id == sector_id)
        return self.db.scalar(statement)

    def create_user(self, *, payload: UserAdminCreate, username: str, password_hash: str) -> User:
        roles = [role.value for role in payload.roles]
        user = User(
            name=payload.name.strip(),
            username=username,
            email=str(payload.email).lower(),
            password_hash=password_hash,
            role=payload.roles[0],
            roles=roles,
            company_id=payload.company_ids[0] if payload.company_ids else None,
            company_ids=payload.company_ids,
            sector_id=payload.sector_ids[0] if payload.sector_ids else None,
            sector_ids=payload.sector_ids,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def save(self, user: User) -> None:
        self.db.add(user)
        self.db.flush()

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.flush()
