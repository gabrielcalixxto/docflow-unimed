from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    version_id: Mapped[int | None] = mapped_column(ForeignKey("document_versions.id"), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str] = mapped_column(String(80), index=True)
    entity_label: Mapped[str | None] = mapped_column(String(180), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    actor_name_snapshot: Mapped[str | None] = mapped_column(String(120), nullable=True)
    field_name: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(255), nullable=True)
    request_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    request_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)

    user = relationship("User", back_populates="audit_logs")
    document = relationship("Document")
    version = relationship("DocumentVersion")
    changes = relationship("AuditLogChange", back_populates="event", cascade="all, delete-orphan")

    @property
    def user_name(self) -> str | None:
        if self.user is None:
            return self.actor_name_snapshot
        return self.user.name
