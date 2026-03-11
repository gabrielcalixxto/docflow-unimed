from unittest.mock import Mock

from app.schemas.common import MessageResponse


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
