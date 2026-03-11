from app.core.enums import DocumentEventType


class AuditService:
    def create_placeholder_event(
        self,
        *,
        event_type: DocumentEventType,
        document_id: int | None = None,
        version_id: int | None = None,
        user_id: int | None = None,
    ) -> dict[str, int | str | None]:
        return {
            "event_type": event_type.value,
            "document_id": document_id,
            "version_id": version_id,
            "user_id": user_id,
        }
