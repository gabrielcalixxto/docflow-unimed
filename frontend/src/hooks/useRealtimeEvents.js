import { useEffect, useRef } from "react";

import { getApiBaseUrl, getStoredToken } from "../services/api";

const RECONNECT_DELAY_MS = 3000;

function buildWebSocketUrl(token) {
  if (!token) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(apiBaseUrl);
  } catch {
    return null;
  }

  const socketProtocol = parsedBaseUrl.protocol === "https:" ? "wss:" : "ws:";
  const pathPrefix =
    parsedBaseUrl.pathname && parsedBaseUrl.pathname !== "/"
      ? parsedBaseUrl.pathname.replace(/\/+$/, "")
      : "";

  const socketUrl = new URL(`${socketProtocol}//${parsedBaseUrl.host}`);
  socketUrl.pathname = `${pathPrefix}/ws/events`;
  socketUrl.searchParams.set("token", token);
  return socketUrl.toString();
}

export default function useRealtimeEvents(
  onRefresh,
  { enabled = true, channels = [], actions = [], debounceMs = 600 } = {},
) {
  const onRefreshRef = useRef(onRefresh);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const normalizedChannels = Array.isArray(channels) ? channels.filter(Boolean) : [];
    const normalizedActions = Array.isArray(actions) ? actions.filter(Boolean) : [];

    let disposed = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const clearRefreshTimeout = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        return;
      }
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        onRefreshRef.current?.();
      }, debounceMs);
    };

    const closeSocket = () => {
      if (!socketRef.current) {
        return;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimeoutRef.current) {
        return;
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, RECONNECT_DELAY_MS);
    };

    const shouldHandleEvent = (payload) => {
      if (!payload || payload.type !== "event") {
        return false;
      }
      if (payload.channel === "connection") {
        return false;
      }
      if (normalizedChannels.length > 0 && !normalizedChannels.includes(payload.channel)) {
        return false;
      }
      if (normalizedActions.length > 0 && !normalizedActions.includes(payload.action)) {
        return false;
      }
      return true;
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      const token = getStoredToken();
      const socketUrl = buildWebSocketUrl(token);
      if (!socketUrl) {
        scheduleReconnect();
        return;
      }

      try {
        const socket = new WebSocket(socketUrl);
        socketRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (shouldHandleEvent(payload)) {
              scheduleRefresh();
            }
          } catch {
            // Ignore malformed events.
          }
        };

        socket.onclose = () => {
          if (disposed) {
            return;
          }
          scheduleReconnect();
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimeout();
      clearRefreshTimeout();
      closeSocket();
    };
  }, [enabled, debounceMs, channels.join("|"), actions.join("|")]);
}
