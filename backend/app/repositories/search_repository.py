from sqlalchemy import and_, false, or_, select, true
from sqlalchemy.orm import Session, joinedload

from app.core.enums import DocumentScope, DocumentStatus
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
        local_visibility_filter = Document.sector_id.in_(user_sector_ids) if user_sector_ids else false()

        visibility_filter = or_(
            and_(
                Document.scope == DocumentScope.LOCAL,
                local_visibility_filter,
            ),
            and_(
                Document.scope == DocumentScope.CORPORATIVO,
                true(),
            ),
        )

        statement = (
            select(Document, DocumentVersion)
            .join(DocumentVersion, DocumentVersion.document_id == Document.id)
            .options(joinedload(Document.creator), joinedload(DocumentVersion.approver))
            .where(
                DocumentVersion.status == DocumentStatus.VIGENTE,
                visibility_filter,
            )
            .order_by(Document.created_at.desc())
        )
        rows = self.db.execute(statement).all()
        return [(document, version) for document, version in rows]
