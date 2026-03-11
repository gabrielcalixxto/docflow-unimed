from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum as SqlEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import DocumentScope


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    sector_id: Mapped[int] = mapped_column(ForeignKey("sectors.id"))
    document_type: Mapped[str] = mapped_column(String(120))
    scope: Mapped[DocumentScope] = mapped_column(
        SqlEnum(DocumentScope, name="document_scope"),
        default=DocumentScope.LOCAL,
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    company = relationship("Company", back_populates="documents")
    sector = relationship("Sector", back_populates="documents")
    creator = relationship("User", back_populates="created_documents", foreign_keys=[created_by])
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    events = relationship("DocumentEvent", back_populates="document", cascade="all, delete-orphan")
