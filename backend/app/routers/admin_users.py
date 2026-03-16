import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import AuditContext, get_audit_context
from app.core.database import get_db
from app.core.realtime import build_realtime_event, realtime_broker
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.user_repository import UserRepository
from app.schemas.common import MessageResponse
from app.schemas.errors import build_standard_error_responses
from app.schemas.user_admin import UserAdminCreate, UserAdminOptionsRead, UserAdminRead, UserAdminUpdate
from app.services.audit_service import AuditService
from app.services.errors import ServiceError
from app.services.user_admin_service import UserAdminService

router = APIRouter(prefix="/admin/users", tags=["Users"])

ADMIN_USER_ERRORS = build_standard_error_responses(401, 403, 404, 409, 422, 500)


def _extract_user_id_from_message(message: str) -> int | None:
    match = re.search(r"id=(\d+)", message or "")
    if not match:
        return None
    return int(match.group(1))


def _publish_user_event(
    *, action: str, current_user: AuthenticatedUser, entity_id: int | None = None
) -> None:
    realtime_broker.publish(
        build_realtime_event(
            channel="users",
            action=action,
            user_id=current_user.user_id,
            entity_type="user",
            entity_id=entity_id,
        )
    )


def get_user_admin_service(db: Session = Depends(get_db)) -> UserAdminService:
    return UserAdminService(
        repository=UserRepository(db),
        audit_service=AuditService(log_repository=AuditLogRepository(db)),
    )


@router.get(
    "",
    response_model=list[UserAdminRead],
    summary="Listar usuários",
    description="Retorna usuários cadastrados para gestão de acesso.",
    responses=ADMIN_USER_ERRORS,
)
def list_users(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserAdminRead]:
    service = get_user_admin_service(db)
    try:
        return service.list_users(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/options",
    response_model=UserAdminOptionsRead,
    summary="Listar opções para cadastro de usuário",
    description="Retorna papéis, empresas e setores disponíveis para associação.",
    responses=ADMIN_USER_ERRORS,
)
def get_user_options(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserAdminOptionsRead:
    service = get_user_admin_service(db)
    try:
        return service.get_options(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar usuário",
    description="Cria usuário com múltiplos papéis, empresas e setores.",
    responses=ADMIN_USER_ERRORS,
)
def create_user(
    payload: UserAdminCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        response = service.create_user(payload, current_user, audit_context=audit_context)
        _publish_user_event(
            action="user_created",
            current_user=current_user,
            entity_id=_extract_user_id_from_message(response.message),
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Atualizar usuário",
    description="Atualiza dados e permissões de um usuário existente.",
    responses=ADMIN_USER_ERRORS,
)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        response = service.update_user(user_id, payload, current_user, audit_context=audit_context)
        _publish_user_event(action="user_updated", current_user=current_user, entity_id=user_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.patch(
    "/{user_id}/inactivate",
    response_model=MessageResponse,
    summary="Inativar usuario",
    description="Inativa usuario existente (exceto o proprio usuario autenticado).",
    responses=ADMIN_USER_ERRORS,
)
def inactivate_user(
    user_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        response = service.inactivate_user(user_id, current_user, audit_context=audit_context)
        _publish_user_event(action="user_inactivated", current_user=current_user, entity_id=user_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.patch(
    "/{user_id}/reactivate",
    response_model=MessageResponse,
    summary="Reativar usuario",
    description="Reativa usuario existente.",
    responses=ADMIN_USER_ERRORS,
)
def reactivate_user(
    user_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        response = service.reactivate_user(user_id, current_user, audit_context=audit_context)
        _publish_user_event(action="user_reactivated", current_user=current_user, entity_id=user_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Excluir usuário",
    description="Exclui usuário existente (exceto o próprio usuário autenticado).",
    responses=ADMIN_USER_ERRORS,
)
def delete_user(
    user_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        response = service.delete_user(user_id, current_user, audit_context=audit_context)
        _publish_user_event(action="user_deleted", current_user=current_user, entity_id=user_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
