from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum as SqlEnum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import DocumentEventType


class DocumentEvent(Base):
    __tablename__ = "document_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    version_id: Mapped[int | None] = mapped_column(ForeignKey("document_versions.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[DocumentEventType] = mapped_column(
        SqlEnum(DocumentEventType, name="document_event_type"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    document = relationship("Document", back_populates="events")
    version = relationship("DocumentVersion", back_populates="events")
    user = relationship("User", back_populates="events")
