from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.schemas.audit import AuditLogListResponse
from app.services.audit_service import AuditService
from app.services.errors import ForbiddenServiceError


class AuditLogService:
    def __init__(self, audit_service: AuditService):
        self.audit_service = audit_service

    def list_logs(
        self,
        *,
        current_user: AuthenticatedUser,
        term: str | None = None,
        entity_type: str | None = None,
        action: str | None = None,
        user_id: int | None = None,
        document_id: int | None = None,
        request_id: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> AuditLogListResponse:
        self._ensure_can_view_audit_logs(current_user)
        return self.audit_service.list_logs(
            term=term,
            entity_type=entity_type,
            action=action,
            user_id=user_id,
            document_id=document_id,
            request_id=request_id,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def _ensure_can_view_audit_logs(current_user: AuthenticatedUser) -> None:
        if not current_user.has_role(UserRole.ADMIN):
            raise ForbiddenServiceError("Only admin users can access audit history.")
