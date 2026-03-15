from sqlalchemy import Enum as SqlEnum
from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole, name="user_role"), default=UserRole.LEITOR)
    roles: Mapped[list[str]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    company_ids: Mapped[list[int]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)
    sector_id: Mapped[int | None] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    sector_ids: Mapped[list[int]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)

    company = relationship("Company")
    sector = relationship("Sector", back_populates="users")
    created_documents = relationship("Document", back_populates="creator", foreign_keys="Document.created_by")
    created_versions = relationship(
        "DocumentVersion",
        back_populates="creator",
        foreign_keys="DocumentVersion.created_by",
    )
    approved_versions = relationship(
        "DocumentVersion",
        back_populates="approver",
        foreign_keys="DocumentVersion.approved_by",
    )
    invalidated_versions = relationship(
        "DocumentVersion",
        back_populates="invalidator",
        foreign_keys="DocumentVersion.invalidated_by",
    )
    uploaded_files = relationship("StoredFile", back_populates="uploader", foreign_keys="StoredFile.uploaded_by")
    events = relationship("DocumentEvent", back_populates="user")
