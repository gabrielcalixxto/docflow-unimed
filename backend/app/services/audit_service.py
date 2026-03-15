from app.core.enums import DocumentEventType
from app.repositories.document_event_repository import DocumentEventRepository


class AuditService:
    def __init__(self, repository: DocumentEventRepository | None = None):
        self.repository = repository

    def create_event(
        self,
        *,
        event_type: DocumentEventType,
        document_id: int | None = None,
        version_id: int | None = None,
        user_id: int | None = None,
    ):
        if self.repository is None:
            return {
                "event_type": event_type.value,
                "document_id": document_id,
                "version_id": version_id,
                "user_id": user_id,
            }
        return self.repository.create_event(
            event_type=event_type,
            document_id=document_id,
            version_id=version_id,
            user_id=user_id,
        )

    def create_placeholder_event(
        self,
        *,
        event_type: DocumentEventType,
        document_id: int | None = None,
        version_id: int | None = None,
        user_id: int | None = None,
    ):
        return self.create_event(
            event_type=event_type,
            document_id=document_id,
            version_id=version_id,
            user_id=user_id,
        )
