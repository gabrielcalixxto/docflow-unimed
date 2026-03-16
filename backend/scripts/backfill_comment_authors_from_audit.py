from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.audit_log import AuditLog
from app.models.audit_log_change import AuditLogChange
from app.models.document import Document


def resolve_latest_actor_user_id(db, document_id: int, field_name: str) -> int | None:
    row = db.execute(
        select(AuditLog.user_id)
        .join(AuditLogChange, AuditLogChange.audit_log_id == AuditLog.id)
        .where(
            AuditLog.document_id == document_id,
            AuditLog.user_id.is_not(None),
            AuditLogChange.field_name == field_name,
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(1)
    ).first()
    if row is None or row[0] is None:
        return None
    return int(row[0])


def main() -> None:
    db = SessionLocal()
    filled_adjustment = 0
    filled_reply = 0
    try:
        documents = db.scalars(
            select(Document).where(
                Document.adjustment_comment.is_not(None),
                Document.adjustment_comment_by.is_(None),
            )
        ).all()
        for document in documents:
            actor_user_id = resolve_latest_actor_user_id(
                db,
                document_id=int(document.id),
                field_name="adjustment_comment",
            )
            if actor_user_id is None:
                continue
            document.adjustment_comment_by = actor_user_id
            filled_adjustment += 1

        reply_documents = db.scalars(
            select(Document).where(
                Document.adjustment_reply_comment.is_not(None),
                Document.adjustment_reply_comment_by.is_(None),
            )
        ).all()
        for document in reply_documents:
            actor_user_id = resolve_latest_actor_user_id(
                db,
                document_id=int(document.id),
                field_name="adjustment_reply_comment",
            )
            if actor_user_id is None:
                continue
            document.adjustment_reply_comment_by = actor_user_id
            filled_reply += 1

        db.commit()
        print(f"filled_adjustment_comment_by={filled_adjustment}")
        print(f"filled_adjustment_reply_comment_by={filled_reply}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
