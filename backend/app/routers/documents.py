import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.audit import AuditContext, get_audit_context
from app.core.database import get_db
from app.core.enums import DocumentScope, DocumentStatus
from app.core.realtime import build_realtime_event, realtime_broker
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.auth_repository import AuthRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.document_event_repository import DocumentEventRepository
from app.repositories.stored_file_repository import StoredFileRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.audit import AuditLogListResponse
from app.schemas.common import MessageResponse
from app.schemas.document import (
    DocumentCreate,
    DocumentDraftUpdate,
    DocumentFormOptionsRead,
    DocumentRead,
    DocumentRejectRequest,
)
from app.schemas.errors import build_standard_error_responses
from app.schemas.workflow import WorkflowDocumentListResponse
from app.services.audit_service import AuditService
from app.services.document_service import DocumentService
from app.services.errors import ServiceError

router = APIRouter(prefix="/documents", tags=["Documents"])

DOCUMENT_CREATE_ERRORS = build_standard_error_responses(401, 403, 404, 409, 422, 500)
DOCUMENT_QUERY_ERRORS = build_standard_error_responses(401, 403, 404, 422, 500)
DOCUMENT_LIST_ERRORS = build_standard_error_responses(401, 403, 422, 500)
DOCUMENT_FLOW_ERRORS = build_standard_error_responses(401, 403, 404, 409, 422, 500)


def _extract_document_id_from_message(message: str) -> int | None:
    match = re.search(r"id=(\d+)", message or "")
    if not match:
        return None
    return int(match.group(1))


def _publish_workflow_event(*, action: str, current_user: AuthenticatedUser, document_id: int | None = None) -> None:
    realtime_broker.publish(
        build_realtime_event(
            channel="workflow",
            action=action,
            user_id=current_user.user_id,
            document_id=document_id,
            entity_type="document",
            entity_id=document_id,
        )
    )


def get_document_service(db: Session) -> DocumentService:
    return DocumentService(
        repository=DocumentRepository(db),
        version_repository=VersionRepository(db),
        file_repository=StoredFileRepository(db),
        auth_repository=AuthRepository(db),
        audit_service=AuditService(
            repository=DocumentEventRepository(db),
            log_repository=AuditLogRepository(db),
        ),
    )


@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar documento",
    description=(
        "Cria um novo documento com versão inicial em rascunho e código automático."
    ),
    responses=DOCUMENT_CREATE_ERRORS,
)
def create_document(
    payload: DocumentCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        response = service.create_document(payload, current_user, audit_context=audit_context)
        _publish_workflow_event(
            action="document_created",
            current_user=current_user,
            document_id=_extract_document_id_from_message(response.message),
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/form-options",
    response_model=DocumentFormOptionsRead,
    summary="Listar opções para formulário de documento",
    description="Retorna empresas, setores, tipos documentais e escopos válidos para criação.",
    responses=build_standard_error_responses(401, 422, 500),
)
def get_document_form_options(
    _: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentFormOptionsRead:
    service = get_document_service(db)
    return service.get_form_options()


@router.get(
    "",
    response_model=list[DocumentRead],
    summary="Listar documentos",
    description="Retorna documentos acessíveis ao usuário conforme escopo e permissões.",
    responses=DOCUMENT_LIST_ERRORS,
)
def list_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    service = get_document_service(db)
    try:
        return service.list_documents(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/workflow",
    response_model=WorkflowDocumentListResponse,
    summary="Listar documentos do workflow",
    description=(
        "Retorna lista paginada com versões e status para fluxo de criação, revisão e aprovação."
    ),
    responses=DOCUMENT_LIST_ERRORS,
)
def list_workflow_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    term: str | None = Query(default=None),
    company_id: int | None = Query(default=None),
    sector_id: int | None = Query(default=None),
    document_type: str | None = Query(default=None),
    scope: DocumentScope | None = Query(default=None),
    latest_status: DocumentStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> WorkflowDocumentListResponse:
    service = get_document_service(db)
    try:
        return service.list_workflow_documents(
            current_user,
            term=term,
            company_id=company_id,
            sector_id=sector_id,
            document_type=document_type,
            scope=scope,
            latest_status=latest_status,
            page=page,
            page_size=page_size,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/{document_id}/events",
    response_model=AuditLogListResponse,
    summary="Listar histórico de eventos de um documento",
    description="Retorna trilha de auditoria do documento informado.",
    responses=DOCUMENT_QUERY_ERRORS,
)
def get_document_events(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    term: str | None = Query(default=None),
    action: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> AuditLogListResponse:
    service = get_document_service(db)
    try:
        return service.list_document_events(
            document_id,
            current_user,
            term=term,
            action=action,
            user_id=user_id,
            page=page,
            page_size=page_size,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/{document_id}",
    response_model=DocumentRead,
    summary="Buscar documento por ID",
    description="Retorna os dados do documento caso o usuário tenha permissão de acesso.",
    responses=DOCUMENT_QUERY_ERRORS,
)
def get_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    service = get_document_service(db)
    try:
        document = service.get_document(document_id, current_user)
        if document is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
        return document
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.patch(
    "/{document_id}/draft",
    response_model=MessageResponse,
    summary="Atualizar rascunho de documento",
    description="Permite ao solicitante editar título, arquivo e vencimento enquanto estiver em rascunho.",
    responses=DOCUMENT_FLOW_ERRORS,
)
def update_draft_document(
    document_id: int,
    payload: DocumentDraftUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        response = service.update_draft_document(document_id, payload, current_user, audit_context=audit_context)
        _publish_workflow_event(action="document_draft_updated", current_user=current_user, document_id=document_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete(
    "/{document_id}/draft",
    response_model=MessageResponse,
    summary="Excluir rascunho de documento",
    description="Remove documento em rascunho criado pelo próprio solicitante.",
    responses=DOCUMENT_FLOW_ERRORS,
)
def delete_draft_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        response = service.delete_draft_document(document_id, current_user, audit_context=audit_context)
        _publish_workflow_event(action="document_draft_deleted", current_user=current_user, document_id=document_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "/{document_id}/submit-review",
    response_model=MessageResponse,
    summary="Enviar rascunho para coordenação",
    description="Move versão de rascunho para pendente de coordenação.",
    responses=DOCUMENT_FLOW_ERRORS,
)
def submit_review(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        response = service.submit_for_review(document_id, current_user, audit_context=audit_context)
        _publish_workflow_event(action="document_submitted", current_user=current_user, document_id=document_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "/{document_id}/approve",
    response_model=MessageResponse,
    summary="Aprovar documento",
    description="Aprova versão pendente e torna vigente, marcando anterior como obsoleta quando aplicável.",
    responses=DOCUMENT_FLOW_ERRORS,
)
def approve_document(
    document_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        response = service.approve_document(document_id, current_user, audit_context=audit_context)
        _publish_workflow_event(action="document_approved", current_user=current_user, document_id=document_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "/{document_id}/reject",
    response_model=MessageResponse,
    summary="Reprovar documento",
    description="Reprova versão no fluxo atual e registra motivo opcional.",
    responses=DOCUMENT_FLOW_ERRORS,
)
def reject_document(
    document_id: int,
    payload: DocumentRejectRequest | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_document_service(db)
    try:
        reason = payload.reason if payload is not None else None
        response = service.reject_document(document_id, current_user, reason=reason, audit_context=audit_context)
        _publish_workflow_event(action="document_rejected", current_user=current_user, document_id=document_id)
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
