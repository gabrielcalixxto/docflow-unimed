import asyncio
from datetime import UTC, datetime
from typing import Any


class RealtimeBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def start(self) -> None:
        self._loop = asyncio.get_running_loop()

    def stop(self) -> None:
        self._subscribers.clear()
        self._loop = None

    def register(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        self._subscribers.add(queue)
        return queue

    def unregister(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    def publish(self, payload: dict[str, Any]) -> None:
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._broadcast, payload)

    def _broadcast(self, payload: dict[str, Any]) -> None:
        stale_queues: list[asyncio.Queue[dict[str, Any]]] = []
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                stale_queues.append(queue)
        for queue in stale_queues:
            self._subscribers.discard(queue)


def build_realtime_event(
    *,
    channel: str,
    action: str,
    user_id: int | None = None,
    document_id: int | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "event",
        "channel": channel,
        "action": action,
        "occurred_at": datetime.now(UTC).isoformat(),
    }
    if user_id is not None:
        payload["user_id"] = user_id
    if document_id is not None:
        payload["document_id"] = document_id
    if entity_type:
        payload["entity_type"] = entity_type
    if entity_id is not None:
        payload["entity_id"] = str(entity_id)
    return payload


realtime_broker = RealtimeBroker()

