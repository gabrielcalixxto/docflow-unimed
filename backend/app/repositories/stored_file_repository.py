from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.stored_file import StoredFile


class StoredFileRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_file(
        self,
        *,
        storage_key: str,
        original_name: str,
        content_type: str | None,
        content: bytes,
        uploaded_by: int | None,
    ) -> StoredFile:
        stored_file = StoredFile(
            storage_key=storage_key,
            original_name=original_name,
            content_type=content_type,
            size_bytes=len(content),
            content=content,
            uploaded_by=uploaded_by,
        )
        self.db.add(stored_file)
        self.db.flush()
        return stored_file

    def get_by_storage_key(self, storage_key: str) -> StoredFile | None:
        statement = select(StoredFile).where(StoredFile.storage_key == storage_key)
        return self.db.scalar(statement)

    def attach_to_version(self, *, storage_key: str, document_id: int, version_id: int) -> None:
        stored_file = self.get_by_storage_key(storage_key)
        if stored_file is None:
            return
        stored_file.document_id = document_id
        stored_file.version_id = version_id
        self.db.add(stored_file)
        self.db.flush()
