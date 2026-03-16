from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import AuditContext, get_audit_context
from app.core.database import get_db
from app.core.realtime import build_realtime_event, realtime_broker
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.admin_catalog_repository import AdminCatalogRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.admin_catalog import (
    AdminCatalogOptionsRead,
    AdminCompanyCreate,
    AdminCompanyUpdate,
    AdminDocumentTypeCreate,
    AdminDocumentTypeUpdate,
    AdminSectorCreate,
    AdminSectorUpdate,
)
from app.schemas.common import MessageResponse
from app.schemas.errors import build_standard_error_responses
from app.services.audit_service import AuditService
from app.services.admin_catalog_service import AdminCatalogService
from app.services.errors import ServiceError

router = APIRouter(prefix="/admin/catalog", tags=["Catalog"])

ADMIN_CATALOG_ERRORS = build_standard_error_responses(401, 403, 404, 409, 422, 500)


def _publish_catalog_event(
    *, action: str, current_user: AuthenticatedUser, entity_type: str, entity_id: int | None = None
) -> None:
    realtime_broker.publish(
        build_realtime_event(
            channel="catalog",
            action=action,
            user_id=current_user.user_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    )


def get_admin_catalog_service(db: Session = Depends(get_db)) -> AdminCatalogService:
    return AdminCatalogService(
        repository=AdminCatalogRepository(db),
        audit_service=AuditService(log_repository=AuditLogRepository(db)),
    )


@router.get(
    "/options",
    response_model=AdminCatalogOptionsRead,
    summary="Listar opções de catálogos",
    description="Retorna empresas, setores e tipos documentais cadastrados.",
    responses=ADMIN_CATALOG_ERRORS,
)
def get_catalog_options(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminCatalogOptionsRead:
    service = get_admin_catalog_service(db)
    try:
        return service.get_options(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "/companies",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar empresa",
    description="Cria uma nova empresa para vinculação de documentos e usuários.",
    responses=ADMIN_CATALOG_ERRORS,
)
def create_company(
    payload: AdminCompanyCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.create_company(payload, current_user, audit_context=audit_context)
        _publish_catalog_event(action="company_created", current_user=current_user, entity_type="company")
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete(
    "/companies/{company_id}",
    response_model=MessageResponse,
    summary="Excluir empresa",
    description="Exclui empresa sem vínculos ativos.",
    responses=ADMIN_CATALOG_ERRORS,
)
def delete_company(
    company_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.delete_company(company_id, current_user, audit_context=audit_context)
        _publish_catalog_event(
            action="company_deleted",
            current_user=current_user,
            entity_type="company",
            entity_id=company_id,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put(
    "/companies/{company_id}",
    response_model=MessageResponse,
    summary="Atualizar empresa",
    description="Atualiza nome da empresa.",
    responses=ADMIN_CATALOG_ERRORS,
)
def update_company(
    company_id: int,
    payload: AdminCompanyUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.update_company(company_id, payload, current_user, audit_context=audit_context)
        _publish_catalog_event(
            action="company_updated",
            current_user=current_user,
            entity_type="company",
            entity_id=company_id,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "/sectors",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar setor",
    description="Cria setor vinculado a uma empresa com sigla única por empresa.",
    responses=ADMIN_CATALOG_ERRORS,
)
def create_sector(
    payload: AdminSectorCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.create_sector(payload, current_user, audit_context=audit_context)
        _publish_catalog_event(action="sector_created", current_user=current_user, entity_type="sector")
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete(
    "/sectors/{sector_id}",
    response_model=MessageResponse,
    summary="Excluir setor",
    description="Exclui setor sem vínculos ativos.",
    responses=ADMIN_CATALOG_ERRORS,
)
def delete_sector(
    sector_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.delete_sector(sector_id, current_user, audit_context=audit_context)
        _publish_catalog_event(
            action="sector_deleted",
            current_user=current_user,
            entity_type="sector",
            entity_id=sector_id,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put(
    "/sectors/{sector_id}",
    response_model=MessageResponse,
    summary="Atualizar setor",
    description="Atualiza nome, sigla e empresa do setor com sincronização de documentos vinculados.",
    responses=ADMIN_CATALOG_ERRORS,
)
def update_sector(
    sector_id: int,
    payload: AdminSectorUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.update_sector(sector_id, payload, current_user, audit_context=audit_context)
        _publish_catalog_event(
            action="sector_updated",
            current_user=current_user,
            entity_type="sector",
            entity_id=sector_id,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post(
    "/document-types",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar tipo documental",
    description="Cria novo tipo documental com sigla e nome.",
    responses=ADMIN_CATALOG_ERRORS,
)
def create_document_type(
    payload: AdminDocumentTypeCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.create_document_type(payload, current_user, audit_context=audit_context)
        _publish_catalog_event(
            action="document_type_created",
            current_user=current_user,
            entity_type="document_type",
            entity_id=None,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete(
    "/document-types/{document_type_id}",
    response_model=MessageResponse,
    summary="Excluir tipo documental",
    description="Exclui tipo documental sem vínculos ativos.",
    responses=ADMIN_CATALOG_ERRORS,
)
def delete_document_type(
    document_type_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.delete_document_type(document_type_id, current_user, audit_context=audit_context)
        _publish_catalog_event(
            action="document_type_deleted",
            current_user=current_user,
            entity_type="document_type",
            entity_id=document_type_id,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put(
    "/document-types/{document_type_id}",
    response_model=MessageResponse,
    summary="Atualizar tipo documental",
    description="Atualiza sigla e nome com sincronização dos documentos vinculados.",
    responses=ADMIN_CATALOG_ERRORS,
)
def update_document_type(
    document_type_id: int,
    payload: AdminDocumentTypeUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    audit_context: AuditContext = Depends(get_audit_context),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        response = service.update_document_type(
            document_type_id,
            payload,
            current_user,
            audit_context=audit_context,
        )
        _publish_catalog_event(
            action="document_type_updated",
            current_user=current_user,
            entity_type="document_type",
            entity_id=document_type_id,
        )
        return response
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
