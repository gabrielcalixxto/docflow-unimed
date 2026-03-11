from app.core.enums import DocumentEventType
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.repositories.document_repository import DocumentRepository
from app.schemas.common import MessageResponse
from app.schemas.document import DocumentCreate
from app.services.audit_service import AuditService


class DocumentService:
    def __init__(self, repository: DocumentRepository, audit_service: AuditService):
        self.repository = repository
        self.audit_service = audit_service

    def create_document(self, payload: DocumentCreate, current_user: AuthenticatedUser) -> MessageResponse:
        self.audit_service.create_placeholder_event(
            event_type=DocumentEventType.DOCUMENT_CREATED,
            user_id=current_user.user_id,
        )
        return MessageResponse(
            message=(
                "Document creation scaffolded. Persistence, validation, and workflow rules "
                "will be implemented in the service layer next."
            )
        )

    def list_documents(self) -> list[Document]:
        return self.repository.list_documents()

    def get_document(self, document_id: int) -> Document | None:
        return self.repository.get_document_by_id(document_id)

    def submit_for_review(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self.audit_service.create_placeholder_event(
            event_type=DocumentEventType.SUBMITTED_FOR_REVIEW,
            document_id=document_id,
            user_id=current_user.user_id,
        )
        return MessageResponse(
            message="Submit review endpoint scaffolded. Transition validation will be added later."
        )

    def approve_document(self, document_id: int, current_user: AuthenticatedUser) -> MessageResponse:
        self.audit_service.create_placeholder_event(
            event_type=DocumentEventType.APPROVED,
            document_id=document_id,
            user_id=current_user.user_id,
        )
        return MessageResponse(
            message="Approve endpoint scaffolded. Version promotion rules will be added later."
        )
