from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.admin_catalog_repository import AdminCatalogRepository
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
from app.services.admin_catalog_service import AdminCatalogService
from app.services.errors import ServiceError

router = APIRouter(prefix="/admin/catalog", tags=["admin-catalog"])


def get_admin_catalog_service(db: Session = Depends(get_db)) -> AdminCatalogService:
    return AdminCatalogService(repository=AdminCatalogRepository(db))


@router.get("/options", response_model=AdminCatalogOptionsRead)
def get_catalog_options(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminCatalogOptionsRead:
    service = get_admin_catalog_service(db)
    try:
        return service.get_options(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/companies", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: AdminCompanyCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.create_company(payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete("/companies/{company_id}", response_model=MessageResponse)
def delete_company(
    company_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.delete_company(company_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put("/companies/{company_id}", response_model=MessageResponse)
def update_company(
    company_id: int,
    payload: AdminCompanyUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.update_company(company_id, payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/sectors", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_sector(
    payload: AdminSectorCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.create_sector(payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete("/sectors/{sector_id}", response_model=MessageResponse)
def delete_sector(
    sector_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.delete_sector(sector_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put("/sectors/{sector_id}", response_model=MessageResponse)
def update_sector(
    sector_id: int,
    payload: AdminSectorUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.update_sector(sector_id, payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/document-types", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_document_type(
    payload: AdminDocumentTypeCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.create_document_type(payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete("/document-types/{document_type_id}", response_model=MessageResponse)
def delete_document_type(
    document_type_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.delete_document_type(document_type_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put("/document-types/{document_type_id}", response_model=MessageResponse)
def update_document_type(
    document_type_id: int,
    payload: AdminDocumentTypeUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_admin_catalog_service(db)
    try:
        return service.update_document_type(document_type_id, payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
