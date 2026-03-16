from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.auth_repository import AuthRepository
from app.schemas.errors import build_standard_error_responses
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService, InvalidCredentialsError

router = APIRouter(prefix="/auth", tags=["Auth"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(repository=AuthRepository(db))


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autenticar usuário",
    description=(
        "Realiza autenticação por login/senha e retorna token Bearer com roles, "
        "setores e empresas autorizadas."
    ),
    responses=build_standard_error_responses(401, 422),
)
def login(payload: LoginRequest, service: AuthService = Depends(get_auth_service)) -> TokenResponse:
    try:
        return service.login(payload)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        ) from exc


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Atualizar sessão autenticada",
    description=(
        "Reemite o token usando o usuário autenticado atual, refletindo permissões "
        "atualizadas no banco sem exigir novo login manual."
    ),
    responses=build_standard_error_responses(401, 422),
)
def refresh_session(
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        return service.refresh_session(
            current_user_subject=current_user.username or current_user.email,
            current_user_id=current_user.user_id,
        )
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session user.",
        ) from exc
