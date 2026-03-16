from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLogChange(Base):
    __tablename__ = "audit_log_changes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    audit_log_id: Mapped[int] = mapped_column(ForeignKey("audit_logs.id"), index=True)
    field_name: Mapped[str] = mapped_column(String(120), index=True)
    field_label: Mapped[str | None] = mapped_column(String(180), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    old_display_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_display_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    event = relationship("AuditLog", back_populates="changes")
