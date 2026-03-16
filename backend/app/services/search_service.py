from app.core.security import AuthenticatedUser
from app.repositories.search_repository import SearchRepository
from app.schemas.search import DocumentSearchResponse, DocumentSearchResult


class SearchService:
    def __init__(self, repository: SearchRepository):
        self.repository = repository

    def search_documents(self, current_user: AuthenticatedUser) -> DocumentSearchResponse:
        rows = self.repository.search_active_documents(current_user)
        items = [
            DocumentSearchResult(
                document_id=document.id,
                code=document.code,
                title=document.title,
                created_by=getattr(document, "created_by", None),
                created_by_name=getattr(document, "created_by_name", None),
                company_id=document.company_id,
                sector_id=document.sector_id,
                document_type=document.document_type,
                scope=document.scope,
                active_version_id=version.id,
                active_version_number=version.version_number,
                file_path=version.file_path,
                expiration_date=version.expiration_date,
                approved_by=version.approved_by,
                approved_by_name=version.approved_by_name,
                approved_at=version.approved_at,
            )
            for document, version in rows
        ]
        return DocumentSearchResponse(items=items)
