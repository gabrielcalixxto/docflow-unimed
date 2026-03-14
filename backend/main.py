from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import RequestResponseLoggingMiddleware, configure_logging
from app.models import company, document, document_event, document_type, document_version, sector, user  # noqa: F401
from app.routers import admin_catalog, admin_users, auth, documents, search, versions

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


def ensure_user_role_enum_values() -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'REVISOR'"))


def ensure_document_status_enum_values() -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'REVISAR_RASCUNHO'"))
        connection.execute(text("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'PENDENTE_COORDENACAO'"))
        connection.execute(text("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'REPROVADO'"))


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


def ensure_document_types_table_supports_sigla() -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("ALTER TABLE document_types ADD COLUMN IF NOT EXISTS sigla VARCHAR(40)"))
        connection.execute(
            text(
                "UPDATE document_types "
                "SET sigla = UPPER(REGEXP_REPLACE(COALESCE(name, ''), '[^A-Za-z0-9]+', '', 'g')) "
                "WHERE sigla IS NULL OR BTRIM(sigla) = ''"
            )
        )
        connection.execute(
            text(
                "UPDATE document_types "
                "SET sigla = 'TIPO' || id::text "
                "WHERE sigla IS NULL OR BTRIM(sigla) = ''"
            )
        )
        connection.execute(text("ALTER TABLE document_types ALTER COLUMN sigla SET NOT NULL"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_document_types_sigla ON document_types (sigla)"))


def ensure_sectors_table_supports_sigla_and_sync_document_codes() -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("ALTER TABLE sectors ADD COLUMN IF NOT EXISTS sigla VARCHAR(40)"))
        connection.execute(
            text(
                "UPDATE sectors "
                "SET sigla = UPPER(REGEXP_REPLACE(COALESCE(sigla, ''), '[^A-Za-z0-9]+', '', 'g')) "
                "WHERE sigla IS NOT NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE sectors "
                "SET sigla = UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(name, ''), '[^A-Za-z0-9]+', '', 'g') FOR 3)) "
                "WHERE sigla IS NULL OR BTRIM(sigla) = ''"
            )
        )
        connection.execute(
            text(
                "UPDATE sectors "
                "SET sigla = 'SET' || id::text "
                "WHERE sigla IS NULL OR BTRIM(sigla) = ''"
            )
        )
        connection.execute(text("ALTER TABLE sectors ALTER COLUMN sigla SET NOT NULL"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_sectors_sigla ON sectors (sigla)"))
        connection.execute(
            text(
                "UPDATE documents d "
                "SET code = ("
                "  CASE "
                "    WHEN BTRIM(UPPER(REGEXP_REPLACE(COALESCE(d.document_type, ''), '[^A-Za-z0-9]+', '', 'g'))) = '' "
                "    THEN 'DOC' "
                "    ELSE UPPER(REGEXP_REPLACE(COALESCE(d.document_type, ''), '[^A-Za-z0-9]+', '', 'g')) "
                "  END"
                ") || '-' || s.sigla || '-' || d.id::text "
                "FROM sectors s "
                "WHERE d.sector_id = s.id"
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        ensure_user_role_enum_values()
        ensure_document_status_enum_values()
        ensure_users_table_supports_multi_access()
        ensure_document_types_table_supports_sigla()
        ensure_sectors_table_supports_sigla_and_sync_document_codes()
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
