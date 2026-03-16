from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Request, Response, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.audit import AuditContext, get_audit_context
from app.core.database import get_db
from app.core.enums import DocumentScope, DocumentStatus, UserRole
from app.core.security import (
    AuthenticatedUser,
    enforce_must_change_password,
    get_authenticated_user_from_token,
    get_current_user,
)
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.stored_file_repository import StoredFileRepository
from app.schemas.errors import build_standard_error_responses
from app.services.audit_service import AuditService

router = APIRouter(prefix="/file-storage", tags=["Attachments"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _build_content_disposition(filename: str, *, as_attachment: bool) -> str:
    safe = (filename or "arquivo").replace('"', "").replace("\r", "").replace("\n", "")
    disposition = "attachment" if as_attachment else "inline"
    return f'{disposition}; filename="{safe}"'


def _extract_access_token(request: Request) -> str | None:
    authorization_header = request.headers.get("authorization")
    if authorization_header and authorization_header.lower().startswith("bearer "):
        return authorization_header[7:].strip()

    query_token = request.query_params.get("token")
    if query_token:
        return query_token.strip()

    return None


def get_current_file_user(request: Request) -> AuthenticatedUser:
    token = _extract_access_token(request)
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error
    try:
        current_user = get_authenticated_user_from_token(token)
    except ValueError as exc:
        raise credentials_error from exc
    enforce_must_change_password(
        current_user,
        request_method=request.method,
        request_path=request.url.path,
    )
    return current_user


def _can_access_document_scope(current_user: AuthenticatedUser, stored_file) -> bool:
    document = stored_file.document
    if document is None:
        return False

    if document.scope == DocumentScope.LOCAL:
        sector_ids = current_user.normalized_sector_ids()
        if not sector_ids:
            return False
        return getattr(document, "sector_id", None) in sector_ids

    if document.scope == DocumentScope.CORPORATIVO:
        return True

    return False


def _can_access_non_vigente_file(current_user: AuthenticatedUser, stored_file) -> bool:
    if current_user.has_any_role({UserRole.COORDENADOR, UserRole.ADMIN}):
        return True

    if current_user.user_id is None:
        return False

    document_owner = getattr(stored_file.document, "created_by", None)
    version_owner = getattr(stored_file.version, "created_by", None)
    return current_user.user_id in {document_owner, version_owner}


def _ensure_can_access_stored_file(current_user: AuthenticatedUser, stored_file) -> None:
    if stored_file.document is None or stored_file.version is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Arquivo sem vinculacao valida de documento.",
        )

    if stored_file.version.document_id != stored_file.document.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Arquivo sem vinculacao valida de documento.",
        )

    if not _can_access_document_scope(current_user, stored_file):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this file.",
        )

    if (
        stored_file.version.status != DocumentStatus.VIGENTE
        and not _can_access_non_vigente_file(current_user, stored_file)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this file version.",
        )


@router.post(
    "/upload",
    summary="Enviar arquivo para armazenamento",
    description="Faz upload do arquivo do documento e retorna caminho lógico para vincular no fluxo.",
    responses=build_standard_error_responses(400, 401, 403, 413, 422, 500),
)
async def upload_document_file(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not current_user.has_role(UserRole.AUTOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only author role can upload files.",
        )

    repository = StoredFileRepository(db)
    audit_service = AuditService(log_repository=AuditLogRepository(db))
    storage_key = uuid4().hex

    try:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Arquivo excede o limite de 25 MB.",
            )
        repository.create_file(
            storage_key=storage_key,
            original_name=file.filename or "arquivo",
            content_type=file.content_type,
            content=content,
            uploaded_by=current_user.user_id,
        )
        audit_service.create_field_change_logs(
            user_id=current_user.user_id,
            entity_type="stored_file",
            entity_id=storage_key,
            action="CREATE",
            context=audit_context,
            entity_label=f"Arquivo {file.filename or 'arquivo'}",
            actor_name=current_user.username or current_user.email,
            changes=[
                {
                    "field_name": "original_name",
                    "field_label": "Nome do arquivo",
                    "old_value": None,
                    "new_value": file.filename or "arquivo",
                    "old_display_value": None,
                    "new_display_value": file.filename or "arquivo",
                },
                {
                    "field_name": "content_type",
                    "field_label": "Tipo de conteudo",
                    "old_value": None,
                    "new_value": file.content_type,
                    "old_display_value": None,
                    "new_display_value": file.content_type,
                },
                {
                    "field_name": "size_bytes",
                    "field_label": "Tamanho",
                    "old_value": None,
                    "new_value": len(content),
                    "old_display_value": None,
                    "new_display_value": str(len(content)),
                },
                {
                    "field_name": "file_path",
                    "field_label": "Caminho do arquivo",
                    "old_value": None,
                    "new_value": f"/file-storage/{storage_key}",
                    "old_display_value": None,
                    "new_display_value": f"/file-storage/{storage_key}",
                },
            ],
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Falha ao salvar arquivo.") from exc
    finally:
        await file.close()

    return {
        "file_path": f"/file-storage/{storage_key}",
        "original_name": file.filename or "arquivo",
    }


@router.get(
    "/{storage_key}",
    summary="Baixar ou visualizar arquivo armazenado",
    description="Retorna conteúdo binário por chave de armazenamento.",
    responses=build_standard_error_responses(401, 403, 404, 422, 500),
)
def get_stored_file(
    storage_key: str = Path(pattern=r"^[A-Fa-f0-9]{32}$"),
    download: bool = Query(default=False),
    current_user: AuthenticatedUser = Depends(get_current_file_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> Response:
    repository = StoredFileRepository(db)
    audit_service = AuditService(log_repository=AuditLogRepository(db))
    stored_file = repository.get_by_storage_key(storage_key.lower())
    if stored_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.")
    _ensure_can_access_stored_file(current_user, stored_file)

    action = "DOWNLOAD_FILE" if download else "VIEW_FILE"
    access_mode = "download" if download else "preview"
    document_id = getattr(stored_file.document, "id", None)
    version_id = getattr(stored_file.version, "id", None)
    original_name = stored_file.original_name or "arquivo"
    audit_service.create_action_log(
        user_id=current_user.user_id,
        actor_name=current_user.username or current_user.email,
        entity_type="stored_file",
        entity_id=storage_key.lower(),
        entity_label=f"Arquivo {original_name}",
        action=action,
        field_name="access_mode",
        field_label="Modo de acesso",
        old_value=None,
        new_value=access_mode,
        old_display_value=None,
        new_display_value="Download" if download else "Visualizacao",
        document_id=document_id,
        version_id=version_id,
        context=audit_context,
    )
    db.commit()

    media_type = stored_file.content_type or "application/octet-stream"
    headers = {"Content-Disposition": _build_content_disposition(stored_file.original_name, as_attachment=download)}
    return Response(content=stored_file.content, media_type=media_type, headers=headers)
