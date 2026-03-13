from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.user_repository import UserRepository
from app.schemas.common import MessageResponse
from app.schemas.user_admin import UserAdminCreate, UserAdminOptionsRead, UserAdminRead, UserAdminUpdate
from app.services.errors import ServiceError
from app.services.user_admin_service import UserAdminService

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


def get_user_admin_service(db: Session = Depends(get_db)) -> UserAdminService:
    return UserAdminService(repository=UserRepository(db))


@router.get("", response_model=list[UserAdminRead])
def list_users(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserAdminRead]:
    service = get_user_admin_service(db)
    try:
        return service.list_users(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/options", response_model=UserAdminOptionsRead)
def get_user_options(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserAdminOptionsRead:
    service = get_user_admin_service(db)
    try:
        return service.get_options(current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserAdminCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        return service.create_user(payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.put("/{user_id}", response_model=MessageResponse)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        return service.update_user(user_id, payload, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = get_user_admin_service(db)
    try:
        return service.delete_user(user_id, current_user)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
