from sqlalchemy import false, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AuditLog
from app.models.audit_log_change import AuditLogChange
from app.models.document import Document


class AuditLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_event(
        self,
        *,
        user_id: int | None,
        actor_name_snapshot: str | None,
        document_id: int | None,
        version_id: int | None,
        entity_type: str,
        entity_id: str,
        entity_label: str | None,
        action: str,
        request_id: str | None,
        ip_address: str | None,
        source_type: str | None,
        source_url: str | None,
        request_path: str | None,
        request_method: str | None,
    ) -> AuditLog:
        event = AuditLog(
            user_id=user_id,
            actor_name_snapshot=actor_name_snapshot,
            document_id=document_id,
            version_id=version_id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            action=action,
            request_id=request_id,
            ip_address=ip_address,
            source_type=source_type,
            source_url=source_url,
            origin=source_url,  # Backward compatibility for existing readers.
            request_path=request_path,
            request_method=request_method,
        )
        self.db.add(event)
        self.db.flush()
        return event

    def add_event_changes(
        self,
        *,
        audit_log_id: int,
        changes: list[dict[str, str | None]],
    ) -> list[AuditLogChange]:
        rows: list[AuditLogChange] = []
        for change in changes:
            row = AuditLogChange(
                audit_log_id=audit_log_id,
                field_name=str(change.get("field_name") or ""),
                field_label=change.get("field_label"),
                old_value=change.get("old_value"),
                new_value=change.get("new_value"),
                old_display_value=change.get("old_display_value"),
                new_display_value=change.get("new_display_value"),
            )
            self.db.add(row)
            rows.append(row)
        self.db.flush()
        return rows

    def list_document_logs(
        self,
        *,
        document_id: int,
        term: str | None = None,
        action: str | None = None,
        user_id: int | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> tuple[list[AuditLog], int]:
        page = max(1, int(page))
        page_size = min(500, max(1, int(page_size)))

        statement = (
            select(AuditLog)
            .options(selectinload(AuditLog.user), selectinload(AuditLog.changes))
            .where(AuditLog.document_id == document_id)
        )
        count_statement = select(func.count()).select_from(AuditLog).where(AuditLog.document_id == document_id)

        statement, count_statement = self._apply_common_filters(
            statement=statement,
            count_statement=count_statement,
            term=term,
            action=action,
            user_id=user_id,
            entity_type=None,
            request_id=None,
        )

        total = int(self.db.scalar(count_statement) or 0)
        paginated = (
            statement.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list(self.db.scalars(paginated).all())
        return rows, total

    def list_logs(
        self,
        *,
        term: str | None = None,
        entity_type: str | None = None,
        action: str | None = None,
        user_id: int | None = None,
        document_id: int | None = None,
        sector_ids: list[int] | None = None,
        request_id: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> tuple[list[AuditLog], int]:
        page = max(1, int(page))
        page_size = min(500, max(1, int(page_size)))

        statement = select(AuditLog).options(selectinload(AuditLog.user), selectinload(AuditLog.changes))
        count_statement = select(func.count()).select_from(AuditLog)

        if document_id is not None:
            statement = statement.where(AuditLog.document_id == document_id)
            count_statement = count_statement.where(AuditLog.document_id == document_id)

        if sector_ids is not None:
            normalized_sector_ids = [
                int(sector_id)
                for sector_id in sector_ids
                if isinstance(sector_id, int)
            ]
            if not normalized_sector_ids:
                statement = statement.where(false())
                count_statement = count_statement.where(false())
            else:
                document_ids_for_sector = select(Document.id).where(Document.sector_id.in_(normalized_sector_ids))
                statement = statement.where(AuditLog.document_id.in_(document_ids_for_sector))
                count_statement = count_statement.where(AuditLog.document_id.in_(document_ids_for_sector))

        statement, count_statement = self._apply_common_filters(
            statement=statement,
            count_statement=count_statement,
            term=term,
            action=action,
            user_id=user_id,
            entity_type=entity_type,
            request_id=request_id,
        )

        total = int(self.db.scalar(count_statement) or 0)
        paginated = (
            statement.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list(self.db.scalars(paginated).all())
        return rows, total

    @staticmethod
    def _apply_common_filters(
        *,
        statement,
        count_statement,
        term: str | None,
        action: str | None,
        user_id: int | None,
        entity_type: str | None,
        request_id: str | None,
    ):
        if entity_type:
            statement = statement.where(AuditLog.entity_type == entity_type)
            count_statement = count_statement.where(AuditLog.entity_type == entity_type)

        if action:
            statement = statement.where(AuditLog.action == action)
            count_statement = count_statement.where(AuditLog.action == action)

        if user_id is not None:
            statement = statement.where(AuditLog.user_id == user_id)
            count_statement = count_statement.where(AuditLog.user_id == user_id)

        if request_id:
            statement = statement.where(AuditLog.request_id == request_id)
            count_statement = count_statement.where(AuditLog.request_id == request_id)

        normalized_term = (term or "").strip().lower()
        if normalized_term:
            like_value = f"%{normalized_term}%"
            term_filter = or_(
                func.lower(func.coalesce(AuditLog.entity_type, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.entity_id, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.entity_label, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.action, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.actor_name_snapshot, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.source_type, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.source_url, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.request_path, "")).like(like_value),
                func.lower(func.coalesce(AuditLog.request_id, "")).like(like_value),
            )
            statement = statement.where(term_filter)
            count_statement = count_statement.where(term_filter)

        return statement, count_statement
