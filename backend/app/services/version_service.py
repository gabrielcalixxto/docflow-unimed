from app.core.enums import DocumentEventType
from app.core.security import AuthenticatedUser
from app.models.document_version import DocumentVersion
from app.repositories.version_repository import VersionRepository
from app.schemas.common import MessageResponse
from app.schemas.version import DocumentVersionCreate
from app.services.audit_service import AuditService


class VersionService:
    def __init__(self, repository: VersionRepository, audit_service: AuditService):
        self.repository = repository
        self.audit_service = audit_service

    def create_version(
        self,
        document_id: int,
        payload: DocumentVersionCreate,
        current_user: AuthenticatedUser,
    ) -> MessageResponse:
        self.audit_service.create_placeholder_event(
            event_type=DocumentEventType.VERSION_CREATED,
            document_id=document_id,
            user_id=current_user.user_id,
        )
        return MessageResponse(
            message=(
                "Version creation scaffolded. Storage, approval flow, and active version "
                "constraints will be implemented later."
            )
        )

    def list_versions(self, document_id: int) -> list[DocumentVersion]:
        return self.repository.list_versions_for_document(document_id)
