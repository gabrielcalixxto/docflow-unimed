from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Sector(Base):
    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))

    company = relationship("Company", back_populates="sectors")
    users = relationship("User", back_populates="sector")
    documents = relationship("Document", back_populates="sector")
