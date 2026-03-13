from unittest.mock import Mock

from app.schemas.common import MessageResponse
from app.services.errors import ConflictServiceError, ForbiddenServiceError, NotFoundServiceError


def test_create_document_returns_201_and_calls_service(
    authorized_client, current_user, document_payload, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.create_document.return_value = MessageResponse(message="created")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents", json=document_payload.model_dump(mode="json"))

    assert response.status_code == 201
    assert response.json() == {"message": "created"}
    service.create_document.assert_called_once()
    _, user_arg = service.create_document.call_args.args
    assert user_arg.user_id == current_user.user_id


def test_create_document_returns_403_when_service_blocks_action(
    authorized_client, document_payload, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.create_document.side_effect = ForbiddenServiceError(
        "Only author, reviewer, or coordinator can modify documents."
    )
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents", json=document_payload.model_dump(mode="json"))

    assert response.status_code == 403
    assert response.json() == {"detail": "Only author, reviewer, or coordinator can modify documents."}


def test_get_document_form_options_returns_items(authorized_client, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.get_form_options.return_value = {
        "companies": [{"id": 1, "name": "DocFlow Unimed"}],
        "sectors": [{"id": 10, "name": "Qualidade", "company_id": 1}],
        "document_types": ["POP", "IT"],
        "scopes": ["LOCAL", "CORPORATIVO"],
    }
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.get("/documents/form-options")

    assert response.status_code == 200
    assert response.json()["companies"][0]["id"] == 1
    assert response.json()["sectors"][0]["id"] == 10


def test_list_documents_returns_items(authorized_client, fake_document, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.list_documents.return_value = [fake_document]
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.get("/documents")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == fake_document.id
    assert body[0]["code"] == fake_document.code


def test_get_document_returns_404_when_not_found(authorized_client, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.get_document.return_value = None
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.get("/documents/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found."}


def test_get_document_returns_item_when_found(authorized_client, fake_document, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.get_document.return_value = fake_document
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.get("/documents/1")

    assert response.status_code == 200
    assert response.json()["id"] == fake_document.id


def test_update_draft_document_calls_service_and_returns_message(
    authorized_client, current_user, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.update_draft_document.return_value = MessageResponse(message="updated")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.patch(
        "/documents/10/draft",
        json={
            "title": "Novo titulo",
            "file_path": "/tmp/new.pdf",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "updated"}
    service.update_draft_document.assert_called_once()
    _, _, user_arg = service.update_draft_document.call_args.args
    assert user_arg.user_id == current_user.user_id


def test_delete_draft_document_calls_service_and_returns_message(
    authorized_client, current_user, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.delete_draft_document.return_value = MessageResponse(message="deleted")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.delete("/documents/10/draft")

    assert response.status_code == 200
    assert response.json() == {"message": "deleted"}
    service.delete_draft_document.assert_called_once()
    _, user_arg = service.delete_draft_document.call_args.args
    assert user_arg.user_id == current_user.user_id


def test_submit_review_calls_service_and_returns_message(
    authorized_client, current_user, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.submit_for_review.return_value = MessageResponse(message="submitted")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents/10/submit-review")

    assert response.status_code == 200
    assert response.json() == {"message": "submitted"}
    service.submit_for_review.assert_called_once()
    _, user_arg = service.submit_for_review.call_args.args
    assert user_arg.user_id == current_user.user_id


def test_submit_review_returns_409_on_invalid_transition(authorized_client, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.submit_for_review.side_effect = ConflictServiceError(
        "Only draft versions can be submitted for review."
    )
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents/10/submit-review")

    assert response.status_code == 409
    assert response.json() == {"detail": "Only draft versions can be submitted for review."}


def test_update_draft_document_returns_403_when_service_blocks(authorized_client, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.update_draft_document.side_effect = ForbiddenServiceError(
        "Only the requester can edit or delete this draft."
    )
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.patch("/documents/10/draft", json={"title": "novo"})

    assert response.status_code == 403
    assert response.json() == {"detail": "Only the requester can edit or delete this draft."}


def test_approve_document_calls_service_and_returns_message(
    authorized_client, current_user, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.approve_document.return_value = MessageResponse(message="approved")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents/10/approve")

    assert response.status_code == 200
    assert response.json() == {"message": "approved"}
    service.approve_document.assert_called_once()
    _, user_arg = service.approve_document.call_args.args
    assert user_arg.user_id == current_user.user_id


def test_approve_document_returns_404_when_service_reports_missing_document(
    authorized_client, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.approve_document.side_effect = NotFoundServiceError("Document not found.")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents/999/approve")

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found."}


def test_reject_document_calls_service_and_returns_message(
    authorized_client, current_user, monkeypatch
) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.reject_document.return_value = MessageResponse(message="rejected")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents/10/reject", json={"reason": "ajustar titulo"})

    assert response.status_code == 200
    assert response.json() == {"message": "rejected"}
    service.reject_document.assert_called_once_with(10, current_user, reason="ajustar titulo")


def test_reject_document_returns_409_on_invalid_transition(authorized_client, monkeypatch) -> None:
    import app.routers.documents as documents_router

    service = Mock()
    service.reject_document.side_effect = ConflictServiceError("Only versions in review can be rejected.")
    monkeypatch.setattr(documents_router, "get_document_service", lambda _: service)

    response = authorized_client.post("/documents/10/reject", json={"reason": "motivo"})

    assert response.status_code == 409
    assert response.json() == {"detail": "Only versions in review can be rejected."}
