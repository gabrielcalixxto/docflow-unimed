from __future__ import annotations

import json
import logging
from time import perf_counter
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_SENSITIVE_KEYS = {"password", "password_hash", "access_token", "refresh_token", "authorization"}


def configure_logging(level: str) -> None:
    normalized_level = level.upper()
    resolved_level = getattr(logging, normalized_level, logging.INFO)
    logging.basicConfig(
        level=resolved_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def _sanitize_json_payload(payload: object) -> object:
    if isinstance(payload, dict):
        sanitized: dict[object, object] = {}
        for key, value in payload.items():
            if isinstance(key, str) and key.lower() in _SENSITIVE_KEYS:
                sanitized[key] = "***"
            else:
                sanitized[key] = _sanitize_json_payload(value)
        return sanitized
    if isinstance(payload, list):
        return [_sanitize_json_payload(item) for item in payload]
    return payload


class RequestResponseLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        log_response_body: bool = True,
        max_body_chars: int = 1200,
    ) -> None:
        super().__init__(app)
        self.log_response_body = log_response_body
        self.max_body_chars = max_body_chars
        self.logger = logging.getLogger("app.http")

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = uuid4().hex[:8]
        method = request.method
        path = request.url.path
        query = str(request.url.query)
        started_at = perf_counter()

        self.logger.info(
            "request_id=%s request_start method=%s path=%s query=%s",
            request_id,
            method,
            path,
            query or "-",
        )

        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (perf_counter() - started_at) * 1000
            self.logger.exception(
                "request_id=%s request_error method=%s path=%s elapsed_ms=%.2f",
                request_id,
                method,
                path,
                elapsed_ms,
            )
            raise

        elapsed_ms = (perf_counter() - started_at) * 1000
        status_code = response.status_code
        content_type = response.headers.get("content-type", "")

        if self.log_response_body and "application/json" in content_type:
            body_text = self._build_body_text(response)
            self.logger.info(
                "request_id=%s request_end method=%s path=%s status=%s elapsed_ms=%.2f body=%s",
                request_id,
                method,
                path,
                status_code,
                elapsed_ms,
                body_text,
            )
        else:
            self.logger.info(
                "request_id=%s request_end method=%s path=%s status=%s elapsed_ms=%.2f",
                request_id,
                method,
                path,
                status_code,
                elapsed_ms,
            )

        return response

    def _build_body_text(self, response: Response) -> str:
        body_bytes = getattr(response, "body", None)
        if body_bytes is None:
            return "<body_not_available>"

        try:
            parsed = json.loads(body_bytes.decode("utf-8"))
            sanitized = _sanitize_json_payload(parsed)
            body_text = json.dumps(sanitized, ensure_ascii=False)
        except (UnicodeDecodeError, json.JSONDecodeError):
            body_text = "<non_json_body>"

        if len(body_text) > self.max_body_chars:
            return f"{body_text[:self.max_body_chars]}...<truncated>"
        return body_text
