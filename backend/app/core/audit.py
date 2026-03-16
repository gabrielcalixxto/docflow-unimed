from dataclasses import dataclass

from fastapi import Request


@dataclass(slots=True)
class AuditContext:
    request_id: str | None = None
    ip_address: str | None = None
    source_type: str | None = None
    source_url: str | None = None
    request_path: str | None = None
    request_method: str | None = None


def _extract_ip_address(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        value = forwarded.split(",")[0].strip()
        if value:
            return value

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        value = real_ip.strip()
        if value:
            return value

    client = request.client
    if client and client.host:
        return str(client.host)
    return None


def _extract_source(request: Request) -> tuple[str | None, str | None]:
    origin = (request.headers.get("origin") or "").strip()
    referer = (request.headers.get("referer") or "").strip()
    user_agent = (request.headers.get("user-agent") or "").strip().lower()

    if origin:
        return "FRONTEND_WEB", origin[:255]

    if referer:
        return "FRONTEND_WEB", referer[:255]

    if user_agent and ("curl" in user_agent or "python-requests" in user_agent or "postman" in user_agent):
        return "API_CLIENT", None

    if request.url.path.startswith("/internal/"):
        return "API_INTERNA", None

    if request.headers.get("x-scheduled-job") == "1":
        return "JOB_AUTOMATICO", None

    if request.headers.get("x-admin-script") == "1":
        return "SCRIPT_ADMINISTRATIVO", None

    if user_agent:
        return "API_INTERNA", None

    return None, None


def _fallback_source_url(request: Request) -> str | None:
    user_agent = (request.headers.get("user-agent") or "").strip()
    if user_agent:
        return user_agent[:255]
    return None


def get_audit_context(request: Request) -> AuditContext:
    request_id = getattr(request.state, "request_id", None)
    source_type, source_url = _extract_source(request)
    return AuditContext(
        request_id=str(request_id) if request_id else None,
        ip_address=_extract_ip_address(request),
        source_type=source_type,
        source_url=source_url or _fallback_source_url(request),
        request_path=str(request.url.path) if request.url.path else None,
        request_method=str(request.method) if request.method else None,
    )
