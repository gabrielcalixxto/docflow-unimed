from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import RequestResponseLoggingMiddleware, configure_logging
from app.core.seed import seed_default_users
from app.models import company, document, document_event, document_type, document_version, sector, user  # noqa: F401
from app.routers import admin_catalog, admin_users, auth, documents, search, versions

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


def ensure_user_role_enum_values() -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'REVISOR'"))


def ensure_users_table_supports_multi_access() -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(120)"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS roles JSONB"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_ids JSONB"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS sector_ids JSONB"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
        connection.execute(
            text(
                "DO $$ BEGIN "
                "ALTER TABLE users "
                "ADD CONSTRAINT fk_users_company_id "
                "FOREIGN KEY (company_id) REFERENCES companies(id); "
                "EXCEPTION WHEN duplicate_object THEN NULL; "
                "END $$;"
            )
        )

        connection.execute(
            text(
                "UPDATE users "
                "SET username = split_part(email, '@', 1) "
                "WHERE username IS NULL OR btrim(username) = ''"
            )
        )
        connection.execute(
            text(
                "UPDATE users "
                "SET roles = to_jsonb(ARRAY[role::text]) "
                "WHERE roles IS NULL OR jsonb_typeof(roles) <> 'array' OR jsonb_array_length(roles) = 0"
            )
        )
        connection.execute(
            text(
                "UPDATE users u "
                "SET company_id = s.company_id "
                "FROM sectors s "
                "WHERE (u.company_id IS NULL) AND u.sector_id = s.id"
            )
        )
        connection.execute(
            text(
                "UPDATE users "
                "SET company_ids = CASE "
                "WHEN company_id IS NULL THEN '[]'::jsonb "
                "ELSE to_jsonb(ARRAY[company_id]) "
                "END "
                "WHERE company_ids IS NULL OR jsonb_typeof(company_ids) <> 'array'"
            )
        )
        connection.execute(
            text(
                "UPDATE users "
                "SET sector_ids = CASE "
                "WHEN sector_id IS NULL THEN '[]'::jsonb "
                "ELSE to_jsonb(ARRAY[sector_id]) "
                "END "
                "WHERE sector_ids IS NULL OR jsonb_typeof(sector_ids) <> 'array'"
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        ensure_user_role_enum_values()
        ensure_users_table_supports_multi_access()
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
app.include_router(admin_users.router)
app.include_router(admin_catalog.router)
