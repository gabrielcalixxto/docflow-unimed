from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock
from types import SimpleNamespace

from app.services.audit_service import AuditService


@dataclass
class _StoredChange:
    audit_log_id: int
    field_name: str
    old_value: str | None
    new_value: str | None


class _ThreadSafeAuditLogRepository:
    def __init__(self) -> None:
        self._lock = Lock()
        self._next_id = 1
        self.events: list[dict[str, object | None]] = []
        self.changes: list[_StoredChange] = []

    def create_event(self, **kwargs):
        with self._lock:
            event_id = self._next_id
            self._next_id += 1
            payload = {"id": event_id, **kwargs}
            self.events.append(payload)
        return SimpleNamespace(id=event_id)

    def add_event_changes(self, *, audit_log_id: int, changes: list[dict[str, str | None]]):
        with self._lock:
            for row in changes:
                self.changes.append(
                    _StoredChange(
                        audit_log_id=audit_log_id,
                        field_name=str(row.get("field_name") or ""),
                        old_value=row.get("old_value"),
                        new_value=row.get("new_value"),
                    )
                )
        return []


def test_concurrent_audit_logs_keep_user_data_isolated() -> None:
    repository = _ThreadSafeAuditLogRepository()
    service = AuditService(log_repository=repository)

    def emit_change(user_id: int, old_name: str, new_name: str) -> None:
        service.create_field_change_logs(
            user_id=user_id,
            actor_name=f"usuario.{user_id}",
            entity_type="user",
            entity_id=user_id,
            entity_label=f"Usuario #{user_id}",
            action="UPDATE",
            changes=[("name", old_name, new_name)],
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(emit_change, 101, "Ana", "Ana Maria")
        second = pool.submit(emit_change, 202, "Joao", "Joao Pedro")
        first.result()
        second.result()

    assert len(repository.events) == 2
    assert len(repository.changes) == 2

    changes_by_event = {change.audit_log_id: change for change in repository.changes}
    assert len(changes_by_event) == 2

    users_to_new_name = {}
    for event in repository.events:
        user_id = int(event["user_id"])
        event_id = int(event["id"])
        change = changes_by_event[event_id]
        users_to_new_name[user_id] = change.new_value
        assert change.field_name == "name"

    assert users_to_new_name[101] == "Ana Maria"
    assert users_to_new_name[202] == "Joao Pedro"
