from fastapi import APIRouter

from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    service = AuthService()
    return service.login(payload)
