from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.enums import DocumentStatus
from app.models.document_version import DocumentVersion
from app.schemas.version import DocumentVersionCreate


class VersionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_version(
        self,
        *,
        document_id: int,
        payload: DocumentVersionCreate,
        created_by: int | None,
    ) -> DocumentVersion:
        version = DocumentVersion(
            document_id=document_id,
            version_number=payload.version_number,
            status=payload.status,
            file_path=payload.file_path,
            created_by=created_by,
            expiration_date=payload.expiration_date,
        )
        self.db.add(version)
        self.db.flush()
        return version

    def save(self, version: DocumentVersion) -> None:
        self.db.add(version)
        self.db.flush()

    def list_versions_for_document(self, document_id: int) -> list[DocumentVersion]:
        statement = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .options(
                joinedload(DocumentVersion.creator),
                joinedload(DocumentVersion.approver),
                joinedload(DocumentVersion.invalidator),
            )
            .order_by(DocumentVersion.version_number.desc())
        )
        return list(self.db.scalars(statement).all())

    def get_latest_version_for_document(self, document_id: int) -> DocumentVersion | None:
        statement = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(DocumentVersion.version_number.desc())
            .limit(1)
        )
        return self.db.scalar(statement)

    def get_active_version_for_document(self, document_id: int) -> DocumentVersion | None:
        statement = select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.status == DocumentStatus.VIGENTE,
        )
        return self.db.scalar(statement)

    def get_version_by_number(self, *, document_id: int, version_number: int) -> DocumentVersion | None:
        statement = select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_number == version_number,
        )
        return self.db.scalar(statement)
