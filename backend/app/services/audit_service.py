import json
from collections.abc import Iterable

from app.core.audit import AuditContext
from app.core.enums import DocumentEventType
from app.core.realtime import build_realtime_event, realtime_broker
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.document_event_repository import DocumentEventRepository
from app.schemas.audit import AuditLogChangeRead, AuditLogListResponse, AuditLogRead


class AuditService:
    def __init__(
        self,
        repository: DocumentEventRepository | None = None,
        log_repository: AuditLogRepository | None = None,
    ):
        self.repository = repository
        self.log_repository = log_repository

    def create_event(
        self,
        *,
        event_type: DocumentEventType,
        document_id: int | None = None,
        version_id: int | None = None,
        user_id: int | None = None,
    ):
        if self.repository is None:
            return {
                "event_type": event_type.value,
                "document_id": document_id,
                "version_id": version_id,
                "user_id": user_id,
            }
        return self.repository.create_event(
            event_type=event_type,
            document_id=document_id,
            version_id=version_id,
            user_id=user_id,
        )

    def create_placeholder_event(
        self,
        *,
        event_type: DocumentEventType,
        document_id: int | None = None,
        version_id: int | None = None,
        user_id: int | None = None,
    ):
        return self.create_event(
            event_type=event_type,
            document_id=document_id,
            version_id=version_id,
            user_id=user_id,
        )

    def create_action_log(
        self,
        *,
        user_id: int | None,
        entity_type: str,
        entity_id: int | str,
        action: str,
        field_name: str | None = None,
        field_label: str | None = None,
        old_value: object | None = None,
        new_value: object | None = None,
        old_display_value: object | None = None,
        new_display_value: object | None = None,
        document_id: int | None = None,
        version_id: int | None = None,
        context: AuditContext | None = None,
        entity_label: str | None = None,
        actor_name: str | None = None,
    ):
        change_rows = []
        if field_name:
            change_rows.append(
                {
                    "field_name": field_name,
                    "field_label": field_label,
                    "old_value": self._serialize_value(old_value),
                    "new_value": self._serialize_value(new_value),
                    "old_display_value": self._serialize_value(old_display_value)
                    if old_display_value is not None
                    else self._serialize_value(old_value),
                    "new_display_value": self._serialize_value(new_display_value)
                    if new_display_value is not None
                    else self._serialize_value(new_value),
                }
            )
        return self._create_structured_event(
            user_id=user_id,
            actor_name=actor_name,
            entity_type=entity_type,
            entity_id=str(entity_id),
            entity_label=entity_label,
            action=action,
            document_id=document_id,
            version_id=version_id,
            context=context,
            changes=change_rows,
        )

    def create_field_change_logs(
        self,
        *,
        user_id: int | None,
        entity_type: str,
        entity_id: int | str,
        action: str,
        changes: Iterable[
            tuple[str, object | None, object | None]
            | tuple[str, object | None, object | None, object | None, object | None]
            | dict[str, object | None]
        ],
        document_id: int | None = None,
        version_id: int | None = None,
        context: AuditContext | None = None,
        entity_label: str | None = None,
        actor_name: str | None = None,
    ) -> None:
        normalized_changes: list[dict[str, str | None]] = []
        for item in changes:
            field_name: str | None = None
            field_label: str | None = None
            old_value: object | None = None
            new_value: object | None = None
            old_display_value: object | None = None
            new_display_value: object | None = None

            if isinstance(item, dict):
                field_name = self._as_str(item.get("field_name"))
                field_label = self._as_str(item.get("field_label"))
                old_value = item.get("old_value")
                new_value = item.get("new_value")
                old_display_value = item.get("old_display_value")
                new_display_value = item.get("new_display_value")
            elif isinstance(item, tuple):
                if len(item) == 3:
                    field_name, old_value, new_value = item
                elif len(item) == 5:
                    field_name, old_value, new_value, old_display_value, new_display_value = item
                else:
                    continue
            else:
                continue

            field_name = self._as_str(field_name)
            if not field_name:
                continue

            raw_old = self._serialize_value(old_value)
            raw_new = self._serialize_value(new_value)
            if raw_old == raw_new:
                continue

            normalized_changes.append(
                {
                    "field_name": field_name,
                    "field_label": field_label,
                    "old_value": raw_old,
                    "new_value": raw_new,
                    "old_display_value": self._serialize_value(old_display_value)
                    if old_display_value is not None
                    else raw_old,
                    "new_display_value": self._serialize_value(new_display_value)
                    if new_display_value is not None
                    else raw_new,
                }
            )

        if not normalized_changes:
            return

        self._create_structured_event(
            user_id=user_id,
            actor_name=actor_name,
            entity_type=entity_type,
            entity_id=str(entity_id),
            entity_label=entity_label,
            action=action,
            document_id=document_id,
            version_id=version_id,
            context=context,
            changes=normalized_changes,
        )

    def _create_structured_event(
        self,
        *,
        user_id: int | None,
        actor_name: str | None,
        entity_type: str,
        entity_id: str,
        entity_label: str | None,
        action: str,
        document_id: int | None,
        version_id: int | None,
        context: AuditContext | None,
        changes: list[dict[str, str | None]],
    ):
        if self.log_repository is None:
            return {
                "user_id": user_id,
                "actor_name_snapshot": actor_name,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "entity_label": entity_label,
                "action": action,
                "document_id": document_id,
                "version_id": version_id,
                "request_id": context.request_id if context else None,
                "changes": changes,
            }

        event = self.log_repository.create_event(
            user_id=user_id,
            actor_name_snapshot=actor_name,
            document_id=document_id,
            version_id=version_id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            action=action,
            request_id=context.request_id[:64] if context and context.request_id else None,
            ip_address=context.ip_address[:64] if context and context.ip_address else None,
            source_type=context.source_type[:80] if context and context.source_type else None,
            source_url=context.source_url[:255] if context and context.source_url else None,
            request_path=context.request_path[:255] if context and context.request_path else None,
            request_method=context.request_method[:16] if context and context.request_method else None,
        )
        if changes:
            self.log_repository.add_event_changes(audit_log_id=event.id, changes=changes)
        realtime_broker.publish(
            build_realtime_event(
                channel="audit",
                action="audit_event_created",
                user_id=user_id,
                document_id=document_id,
                entity_type=entity_type,
                entity_id=entity_id,
            )
        )
        return event

    def list_document_logs(
        self,
        *,
        document_id: int,
        term: str | None = None,
        action: str | None = None,
        user_id: int | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> AuditLogListResponse:
        if self.log_repository is None:
            return AuditLogListResponse(items=[], total=0, page=page, page_size=page_size)

        rows, total = self.log_repository.list_document_logs(
            document_id=document_id,
            term=term,
            action=action,
            user_id=user_id,
            page=page,
            page_size=page_size,
        )
        return AuditLogListResponse(
            items=[self._to_read_model(row) for row in rows],
            total=total,
            page=max(1, int(page)),
            page_size=min(500, max(1, int(page_size))),
        )

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
    ) -> AuditLogListResponse:
        if self.log_repository is None:
            return AuditLogListResponse(items=[], total=0, page=page, page_size=page_size)

        rows, total = self.log_repository.list_logs(
            term=term,
            entity_type=entity_type,
            action=action,
            user_id=user_id,
            document_id=document_id,
            sector_ids=sector_ids,
            request_id=request_id,
            page=page,
            page_size=page_size,
        )
        return AuditLogListResponse(
            items=[self._to_read_model(row) for row in rows],
            total=total,
            page=max(1, int(page)),
            page_size=min(500, max(1, int(page_size))),
        )

    @staticmethod
    def _to_read_model(row) -> AuditLogRead:
        normalized = AuditLogRead.model_validate(row)
        if normalized.changes:
            return normalized

        legacy_field_name = getattr(row, "field_name", None)
        if not legacy_field_name:
            return normalized

        legacy_old = getattr(row, "old_value", None)
        legacy_new = getattr(row, "new_value", None)
        legacy_change = AuditLogChangeRead(
            id=0,
            field_name=str(legacy_field_name),
            field_label=None,
            old_value=legacy_old,
            new_value=legacy_new,
            old_display_value=legacy_old,
            new_display_value=legacy_new,
        )
        return normalized.model_copy(update={"changes": [legacy_change]})

    @staticmethod
    def _as_str(value: object | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return str(value)

    @staticmethod
    def _serialize_value(value: object | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value
        if isinstance(value, (int, float, bool)):
            return str(value)
        isoformat = getattr(value, "isoformat", None)
        if callable(isoformat):
            return str(isoformat())
        if isinstance(value, (list, tuple, set, dict)):
            try:
                return json.dumps(value, ensure_ascii=False, default=str)
            except (TypeError, ValueError):
                return str(value)
        try:
            return str(value)
        except Exception:
            return None
