from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import Base, engine
from app.models import company, document, document_event, document_version, sector, user  # noqa: F401
from app.routers import auth, documents, search, versions

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        logger.warning("Database initialization skipped: %s", exc)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(versions.router)
app.include_router(search.router)
