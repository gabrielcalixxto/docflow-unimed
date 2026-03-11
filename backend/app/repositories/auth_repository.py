from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.db.scalar(statement)
