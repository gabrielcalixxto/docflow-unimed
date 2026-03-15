from sqlalchemy.orm import Session

from app.core.enums import DocumentEventType
from app.models.document_event import DocumentEvent


class DocumentEventRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_event(
        self,
        *,
        event_type: DocumentEventType,
        document_id: int | None = None,
        version_id: int | None = None,
        user_id: int | None = None,
    ) -> DocumentEvent:
        event = DocumentEvent(
            event_type=event_type,
            document_id=document_id,
            version_id=version_id,
            user_id=user_id,
        )
        self.db.add(event)
        self.db.flush()
        return event
