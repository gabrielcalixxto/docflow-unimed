from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import RequestResponseLoggingMiddleware, configure_logging
from app.core.seed import seed_default_users
from app.models import company, document, document_event, document_version, sector, user  # noqa: F401
from app.routers import auth, documents, search, versions

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        seed_default_users()
    except SQLAlchemyError as exc:
        logger.warning("Database initialization skipped: %s", exc)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.log_requests:
    app.add_middleware(
        RequestResponseLoggingMiddleware,
        log_response_body=settings.log_response_body,
        max_body_chars=settings.log_response_body_max_chars,
    )


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(search.router)
app.include_router(documents.router)
app.include_router(versions.router)
