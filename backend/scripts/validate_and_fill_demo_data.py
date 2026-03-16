from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path
import sys
from uuid import uuid4

from sqlalchemy import select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import SessionLocal
from app.core.enums import UserRole
from app.core.security import hash_password
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.stored_file import StoredFile
from app.models.user import User

DEFAULT_PASSWORD = "Demo@123"
PLACEHOLDER_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


def ensure_user_demo_data(db) -> int:
    touched = 0
    users = list(db.scalars(select(User).order_by(User.id.asc())).all())

    if not users:
        demo_user = User(
            name="Demo User",
            job_title="Demo Analyst",
            username="demo.user",
            email="demo.user@docflow.local",
            password_hash=hash_password(DEFAULT_PASSWORD),
            role=UserRole.ADMIN,
            roles=[UserRole.ADMIN.value],
            company_ids=[],
            sector_ids=[],
            is_active=True,
            must_change_password=False,
        )
        db.add(demo_user)
        db.flush()
        print("[INFO] No users found. Created demo.user with password Demo@123")
        return 1

    for index, user in enumerate(users, start=1):
        changed = False

        if not (user.name or "").strip():
            user.name = f"Usuario Demo {index}"
            changed = True
        if not (user.job_title or "").strip():
            user.job_title = "Funcao Demo"
            changed = True
        if not (user.username or "").strip():
            user.username = f"usuario.demo{index}"
            changed = True
        if "@" not in (user.email or ""):
            user.email = f"{user.username or f'usuario.demo{index}'}@docflow.local"
            changed = True
        if not (user.password_hash or "").strip():
            user.password_hash = hash_password(DEFAULT_PASSWORD)
            changed = True
        if user.role is None:
            user.role = UserRole.LEITOR
            changed = True
        if not isinstance(user.roles, list) or len(user.roles) == 0:
            user.roles = [user.role.value if isinstance(user.role, UserRole) else str(user.role)]
            changed = True
        if not isinstance(user.company_ids, list):
            user.company_ids = [user.company_id] if user.company_id is not None else []
            changed = True
        if not isinstance(user.sector_ids, list):
            user.sector_ids = [user.sector_id] if user.sector_id is not None else []
            changed = True
        if getattr(user, "is_active", None) is None:
            user.is_active = True
            changed = True
        if getattr(user, "must_change_password", None) is None:
            user.must_change_password = False
            changed = True

        if changed:
            db.add(user)
            touched += 1

    return touched


def ensure_file_demo_data(db) -> int:
    touched = 0

    versions = list(db.scalars(select(DocumentVersion).order_by(DocumentVersion.id.asc())).all())
    files_by_version = {
        file_item.version_id: file_item
        for file_item in db.scalars(select(StoredFile).where(StoredFile.version_id.is_not(None))).all()
    }

    for version in versions:
        existing = files_by_version.get(version.id)
        if existing is not None:
            changed = False
            if not existing.content:
                existing.content = PLACEHOLDER_PDF
                existing.size_bytes = len(PLACEHOLDER_PDF)
                changed = True
            if not (existing.original_name or "").strip():
                existing.original_name = f"DOC-{version.document_id}-V{version.version_number}.pdf"
                changed = True
            if not (existing.content_type or "").strip():
                existing.content_type = "application/pdf"
                changed = True
            if existing.size_bytes != len(existing.content or b""):
                existing.size_bytes = len(existing.content or b"")
                changed = True
            if existing.document_id is None:
                existing.document_id = version.document_id
                changed = True
            if existing.uploaded_by is None:
                existing.uploaded_by = version.created_by
                changed = True
            if changed:
                db.add(existing)
                touched += 1
            if not (version.file_path or "").startswith("/file-storage/"):
                version.file_path = f"/file-storage/{existing.storage_key}"
                db.add(version)
                touched += 1
            continue

        storage_key = uuid4().hex
        generated_name = f"DOC-{version.document_id}-V{version.version_number}.pdf"
        generated_file = StoredFile(
            storage_key=storage_key,
            original_name=generated_name,
            content_type="application/pdf",
            size_bytes=len(PLACEHOLDER_PDF),
            content=PLACEHOLDER_PDF,
            uploaded_by=version.created_by,
            document_id=version.document_id,
            version_id=version.id,
            created_at=datetime.now(UTC),
        )
        db.add(generated_file)
        version.file_path = f"/file-storage/{storage_key}"
        db.add(version)
        touched += 2

    documents = list(db.scalars(select(Document).order_by(Document.id.asc())).all())
    for document in documents:
        changed = False
        if not (document.title or "").strip():
            document.title = f"Documento Demo {document.id}"
            changed = True
        if not (document.document_type or "").strip():
            document.document_type = "DOC"
            changed = True
        if not (document.code or "").strip():
            document.code = f"DOC-DEMO-{document.id}"
            changed = True
        if changed:
            db.add(document)
            touched += 1

    return touched


def main() -> int:
    with SessionLocal() as db:
        user_touched = ensure_user_demo_data(db)
        file_touched = ensure_file_demo_data(db)

        if user_touched == 0 and file_touched == 0:
            print("[OK] Validation finished. No missing login/file fields detected.")
            db.rollback()
            return 0

        db.commit()
        print(
            "[DONE] Validation finished with synthetic completion: "
            f"users changed={user_touched}, files/documents changed={file_touched}."
        )
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
