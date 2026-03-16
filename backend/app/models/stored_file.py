from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StoredFile(Base):
    __tablename__ = "stored_files"
    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_stored_files_storage_key"),
        UniqueConstraint("version_id", name="uq_stored_files_version_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    storage_key: Mapped[str] = mapped_column(String(64), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(160), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    content: Mapped[bytes] = mapped_column(LargeBinary)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    version_id: Mapped[int | None] = mapped_column(ForeignKey("document_versions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    uploader = relationship("User", back_populates="uploaded_files", foreign_keys=[uploaded_by])
    document = relationship("Document", back_populates="stored_files", foreign_keys=[document_id])
    version = relationship("DocumentVersion", back_populates="stored_file", foreign_keys=[version_id])
