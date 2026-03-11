from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document_version import DocumentVersion


class VersionRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_versions_for_document(self, document_id: int) -> list[DocumentVersion]:
        statement = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(DocumentVersion.version_number.desc())
        )
        return list(self.db.scalars(statement).all())
