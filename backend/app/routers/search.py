from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.search_repository import SearchRepository
from app.schemas.errors import build_standard_error_responses
from app.schemas.search import DocumentSearchResponse
from app.services.search_service import SearchService

router = APIRouter(prefix="/documents", tags=["Search"])


def get_search_service(db: Session) -> SearchService:
    repository = SearchRepository(db)
    return SearchService(repository=repository)


@router.get(
    "/search",
    response_model=DocumentSearchResponse,
    summary="Buscar documentos vigentes",
    description="Retorna somente versão vigente visível ao usuário autenticado.",
    responses=build_standard_error_responses(401, 422, 500),
)
def search_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentSearchResponse:
    service = get_search_service(db)
    return service.search_documents(current_user)
