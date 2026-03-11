from unittest.mock import Mock


def test_search_documents_returns_service_payload(
    authorized_client, fake_search_response, monkeypatch
) -> None:
    import app.routers.search as search_router

    service = Mock()
    service.search_documents.return_value = fake_search_response
    monkeypatch.setattr(search_router, "get_search_service", lambda _: service)

    response = authorized_client.get("/documents/search")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert len(body["items"]) == 1
    assert body["items"][0]["active_version_id"] == 11
    assert body["items"][0]["scope"] == "LOCAL"
