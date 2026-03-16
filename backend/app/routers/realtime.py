import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.realtime import build_realtime_event, realtime_broker
from app.core.security import get_authenticated_user_from_token

router = APIRouter(tags=["Realtime"])


def _extract_access_token(websocket: WebSocket) -> str | None:
    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token.strip()

    authorization_header = websocket.headers.get("authorization")
    if authorization_header and authorization_header.lower().startswith("bearer "):
        return authorization_header[7:].strip()

    return None


async def _watch_disconnect(websocket: WebSocket) -> None:
    while True:
        await websocket.receive_text()


@router.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    token = _extract_access_token(websocket)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token.")
        return

    try:
        current_user = get_authenticated_user_from_token(token)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token.")
        return

    await websocket.accept()
    subscription_queue = realtime_broker.register()
    disconnect_watcher = asyncio.create_task(_watch_disconnect(websocket))

    try:
        await websocket.send_json(
            build_realtime_event(
                channel="connection",
                action="connected",
                user_id=current_user.user_id,
            )
        )
        while True:
            next_event_task = asyncio.create_task(subscription_queue.get())
            done, pending = await asyncio.wait(
                {disconnect_watcher, next_event_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if disconnect_watcher in done:
                next_event_task.cancel()
                break
            for task in pending:
                task.cancel()
            payload = next_event_task.result()
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        pass
    finally:
        realtime_broker.unregister(subscription_queue)
        disconnect_watcher.cancel()

