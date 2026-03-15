from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Path, Response, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories.stored_file_repository import StoredFileRepository

router = APIRouter(prefix="/file-storage", tags=["files"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _build_content_disposition(filename: str) -> str:
    safe = (filename or "arquivo").replace('"', "").replace("\r", "").replace("\n", "")
    return f'inline; filename="{safe}"'


@router.post("/upload")
async def upload_document_file(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    repository = StoredFileRepository(db)
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


@router.get("/{storage_key}")
def get_stored_file(
    storage_key: str = Path(pattern=r"^[A-Fa-f0-9]{32}$"),
    db: Session = Depends(get_db),
) -> Response:
    repository = StoredFileRepository(db)
    stored_file = repository.get_by_storage_key(storage_key.lower())
    if stored_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.")

    media_type = stored_file.content_type or "application/octet-stream"
    headers = {"Content-Disposition": _build_content_disposition(stored_file.original_name)}
    return Response(content=stored_file.content, media_type=media_type, headers=headers)
