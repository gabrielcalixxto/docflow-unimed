from datetime import UTC, datetime
from unittest.mock import Mock

from app.schemas.audit import AuditLogListResponse
from app.services.errors import ForbiddenServiceError


def test_list_audit_events_returns_items(authorized_client, monkeypatch) -> None:
    import app.routers.audit as audit_router

    service = Mock()
    service.list_logs.return_value = AuditLogListResponse(
        items=[
            {
                "id": 1,
                "created_at": datetime(2026, 3, 15, 12, 0, tzinfo=UTC),
                "user_id": 99,
                "user_name": "Revisor",
                "entity_type": "company",
                "entity_id": "4",
                "entity_label": "Empresa #4 (HGU Unimed)",
                "action": "UPDATE",
                "changes": [
                    {
                        "id": 1,
                        "field_name": "name",
                        "field_label": "Nome",
                        "old_value": "Hospital Unimed",
                        "new_value": "HGU Unimed",
                        "old_display_value": "Hospital Unimed",
                        "new_display_value": "HGU Unimed",
                    }
                ],
                "request_id": "a1b2c3d4",
                "ip_address": "127.0.0.1",
                "source_type": "FRONTEND_WEB",
                "source_url": "http://localhost:5173",
                "request_path": "/admin/catalog/companies/4",
                "request_method": "PUT",
            }
        ],
        total=1,
        page=1,
        page_size=100,
    )
    monkeypatch.setattr(audit_router, "get_audit_log_service", lambda _: service)

    response = authorized_client.get("/audit/events", params={"page": 1, "page_size": 50})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["changes"][0]["field_name"] == "name"


def test_list_audit_events_returns_403_when_service_blocks(authorized_client, monkeypatch) -> None:
    import app.routers.audit as audit_router

    service = Mock()
    service.list_logs.side_effect = ForbiddenServiceError("Only admin users can access audit history.")
    monkeypatch.setattr(audit_router, "get_audit_log_service", lambda _: service)

    response = authorized_client.get("/audit/events")

    assert response.status_code == 403
    assert response.json() == {"detail": "Only admin users can access audit history."}
