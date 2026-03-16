from app.core.realtime import build_realtime_event
from app.core.security import AuthenticatedUser


def test_ws_events_keeps_connection_open_for_multiple_events(public_client, monkeypatch) -> None:
    import app.routers.realtime as realtime_router

    monkeypatch.setattr(
        realtime_router,
        "get_authenticated_user_from_token",
        lambda _token: AuthenticatedUser(
            email="admin@docflow.local",
            username="admin.docflow",
            role="ADMIN",
            roles=["ADMIN"],
            user_id=1,
        ),
    )

    with public_client.websocket_connect("/ws/events?token=fake-token") as websocket:
        connected = websocket.receive_json()
        assert connected["channel"] == "connection"
        assert connected["action"] == "connected"

        realtime_router.realtime_broker.publish(
            build_realtime_event(channel="workflow", action="first_event", document_id=10)
        )
        first_event = websocket.receive_json()
        assert first_event["channel"] == "workflow"
        assert first_event["action"] == "first_event"
        assert first_event["document_id"] == 10

        realtime_router.realtime_broker.publish(
            build_realtime_event(channel="workflow", action="second_event", document_id=11)
        )
        second_event = websocket.receive_json()
        assert second_event["channel"] == "workflow"
        assert second_event["action"] == "second_event"
        assert second_event["document_id"] == 11
