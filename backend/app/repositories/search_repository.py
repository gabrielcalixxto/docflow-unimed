from sqlalchemy import and_, false, or_, select, true
from sqlalchemy.orm import Session, joinedload

from app.core.enums import DocumentScope, DocumentStatus, UserRole
from app.core.security import AuthenticatedUser
from app.models.document import Document
from app.models.document_version import DocumentVersion


class SearchRepository:
    def __init__(self, db: Session):
        self.db = db

    def search_active_documents(
        self,
        current_user: AuthenticatedUser,
    ) -> list[tuple[Document, DocumentVersion]]:
        user_sector_ids = current_user.normalized_sector_ids()
        user_company_ids = current_user.normalized_company_ids()

        if current_user.has_role(UserRole.ADMIN):
            corporate_visibility_filter = true()
        else:
            corporate_filters = []
            if user_company_ids:
                corporate_filters.append(Document.company_id.in_(user_company_ids))
            if user_sector_ids:
                corporate_filters.append(Document.sector_id.in_(user_sector_ids))
            corporate_visibility_filter = or_(*corporate_filters) if corporate_filters else false()

        visibility_filter = or_(
            Document.scope == DocumentScope.LOCAL,
            and_(
                Document.scope == DocumentScope.CORPORATIVO,
                corporate_visibility_filter,
            ),
        )

        statement = (
            select(Document, DocumentVersion)
            .join(DocumentVersion, DocumentVersion.document_id == Document.id)
            .options(joinedload(DocumentVersion.approver))
            .where(
                DocumentVersion.status == DocumentStatus.VIGENTE,
                visibility_filter,
            )
            .order_by(Document.created_at.desc())
        )
        rows = self.db.execute(statement).all()
        return [(document, version) for document, version in rows]
