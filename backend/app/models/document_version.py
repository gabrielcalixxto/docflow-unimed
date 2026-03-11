from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, Enum as SqlEnum
from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import DocumentStatus


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="uq_document_version_number"),
        Index(
            "ix_document_versions_single_vigente",
            "document_id",
            unique=True,
            postgresql_where=text("status = 'VIGENTE'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    version_number: Mapped[int] = mapped_column()
    status: Mapped[DocumentStatus] = mapped_column(
        SqlEnum(DocumentStatus, name="document_status"),
        default=DocumentStatus.RASCUNHO,
    )
    file_path: Mapped[str] = mapped_column(String(255))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiration_date: Mapped[date] = mapped_column(Date)

    document = relationship("Document", back_populates="versions")
    creator = relationship("User", back_populates="created_versions", foreign_keys=[created_by])
    approver = relationship("User", back_populates="approved_versions", foreign_keys=[approved_by])
    events = relationship("DocumentEvent", back_populates="version", cascade="all, delete-orphan")
