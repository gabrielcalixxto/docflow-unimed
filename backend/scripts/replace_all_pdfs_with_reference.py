from __future__ import annotations

from pathlib import Path
import sys

from sqlalchemy import desc, func, or_, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import SessionLocal
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.stored_file import StoredFile

REFERENCE_DOCUMENT_CODE = "MAN-FAR-20"


def resolve_reference_file(db) -> StoredFile | None:
    reference_document = db.scalar(select(Document).where(Document.code == REFERENCE_DOCUMENT_CODE))
    if reference_document is None:
        print(f"[ERROR] Document code not found: {REFERENCE_DOCUMENT_CODE}")
        return None

    candidate_files = list(
        db.scalars(
            select(StoredFile)
            .join(DocumentVersion, StoredFile.version_id == DocumentVersion.id)
            .where(DocumentVersion.document_id == reference_document.id)
            .order_by(desc(DocumentVersion.version_number), desc(StoredFile.created_at))
        ).all()
    )
    if not candidate_files:
        print(f"[ERROR] No stored PDF found for document code: {REFERENCE_DOCUMENT_CODE}")
        return None

    for stored_file in candidate_files:
        content_type = (stored_file.content_type or "").lower()
        original_name = (stored_file.original_name or "").lower()
        if "pdf" in content_type or original_name.endswith(".pdf"):
            return stored_file

    return candidate_files[0]


def replace_all_pdfs(reference_file: StoredFile) -> int:
    with SessionLocal() as db:
        target_files = list(
            db.scalars(
                select(StoredFile).where(
                    or_(
                        func.lower(func.coalesce(StoredFile.content_type, "")).like("%pdf%"),
                        func.lower(func.coalesce(StoredFile.original_name, "")).like("%.pdf"),
                    ),
                    StoredFile.id != reference_file.id,
                )
            ).all()
        )

        if not target_files:
            print("[INFO] No other PDF files found to replace.")
            return 0

        reference_content = reference_file.content or b""
        reference_size = len(reference_content)

        for target in target_files:
            target.content = reference_content
            target.size_bytes = reference_size
            target.content_type = "application/pdf"
            if not (target.original_name or "").strip().lower().endswith(".pdf"):
                target.original_name = f"{REFERENCE_DOCUMENT_CODE}.pdf"
            db.add(target)

        db.commit()
        return len(target_files)


def main() -> int:
    with SessionLocal() as db:
        reference_file = resolve_reference_file(db)
        if reference_file is None:
            db.rollback()
            return 1

        # Detach data so we can safely reuse outside this session.
        detached_reference = StoredFile(
            id=reference_file.id,
            storage_key=reference_file.storage_key,
            original_name=reference_file.original_name,
            content_type=reference_file.content_type,
            size_bytes=reference_file.size_bytes,
            content=reference_file.content,
        )

    replaced_count = replace_all_pdfs(detached_reference)
    print(f"[DONE] Replaced PDF contents in {replaced_count} file(s) using {REFERENCE_DOCUMENT_CODE}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
