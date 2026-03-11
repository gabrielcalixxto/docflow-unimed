from unittest.mock import Mock

from app.schemas.common import MessageResponse


def test_create_version_returns_201_and_calls_service(
    authorized_client, current_user, version_payload, monkeypatch
) -> None:
    import app.routers.versions as versions_router

    service = Mock()
    service.create_version.return_value = MessageResponse(message="version created")
    monkeypatch.setattr(versions_router, "get_version_service", lambda _: service)

    response = authorized_client.post(
        "/documents/1/versions",
        json=version_payload.model_dump(mode="json"),
    )

    assert response.status_code == 201
    assert response.json() == {"message": "version created"}
    service.create_version.assert_called_once()
    _, _, user_arg = service.create_version.call_args.args
    assert user_arg.user_id == current_user.user_id


def test_list_versions_returns_items(authorized_client, fake_version, monkeypatch) -> None:
    import app.routers.versions as versions_router

    service = Mock()
    service.list_versions.return_value = [fake_version]
    monkeypatch.setattr(versions_router, "get_version_service", lambda _: service)

    response = authorized_client.get("/documents/1/versions")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == fake_version.id
    assert body[0]["version_number"] == fake_version.version_number
