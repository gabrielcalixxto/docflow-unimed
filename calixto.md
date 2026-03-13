# CALIXTO Backend Map (estado atual)

Mapa rapido por modulo, no formato:

- `assinatura`
- `depende_de`

## 1) Bootstrap API

- `main.lifespan(app: FastAPI)`
- `depende_de: Base.metadata.create_all, seed_default_users`

- `main.healthcheck() -> dict[str, str]`
- `depende_de: sem regra de negocio`

Routers registrados:

- `auth`
- `search`
- `documents`
- `versions`
- `admin_users`
- `admin_catalog`

## 2) Core

- `core.config.Settings`
- `depende_de: .env, pydantic-settings`

- `core.database.get_db() -> Generator[Session, None, None]`
- `depende_de: SessionLocal`

- `core.security.create_access_token(...) -> str`
- `depende_de: jose.jwt.encode`

- `core.security.get_current_user(...) -> AuthenticatedUser`
- `depende_de: oauth2_scheme, jose.jwt.decode`

- `core.seed.seed_default_users() -> None`
- `depende_de: SessionLocal, User, Company, Sector, DocumentType`

## 3) Auth

- `routers.auth.login(payload: LoginRequest, db: Session) -> TokenResponse`
- `depende_de: AuthService.login`

- `services.auth.AuthService.login(payload: LoginRequest) -> TokenResponse`
- `depende_de: AuthRepository.get_user_by_email, verify_password, create_access_token`

## 4) Documents

- `routers.documents.create_document(...) -> MessageResponse`
- `depende_de: DocumentService.create_document`

- `routers.documents.get_document_form_options(...) -> DocumentFormOptionsRead`
- `depende_de: DocumentService.get_form_options`

- `routers.documents.list_documents(...) -> list[DocumentRead]`
- `depende_de: DocumentService.list_documents`

- `routers.documents.get_document(document_id: int, ...) -> DocumentRead`
- `depende_de: DocumentService.get_document`

- `routers.documents.update_draft_document(document_id: int, payload: DocumentDraftUpdate, ...) -> MessageResponse`
- `depende_de: DocumentService.update_draft_document`

- `routers.documents.delete_draft_document(document_id: int, ...) -> MessageResponse`
- `depende_de: DocumentService.delete_draft_document`

- `routers.documents.submit_review(...) -> MessageResponse`
- `depende_de: DocumentService.submit_for_review`

- `routers.documents.approve_document(...) -> MessageResponse`
- `depende_de: DocumentService.approve_document`

- `routers.documents.reject_document(...) -> MessageResponse`
- `depende_de: DocumentService.reject_document`

## 5) Versions

- `routers.versions.create_version(...) -> MessageResponse`
- `depende_de: VersionService.create_version`

- `routers.versions.list_versions(document_id: int, ...) -> list[DocumentVersionRead]`
- `depende_de: VersionService.list_versions`

## 6) Search

- `routers.search.search_documents(...) -> DocumentSearchResponse`
- `depende_de: SearchService.search_documents`

## 7) Admin users

- `routers.admin_users.list_users(...) -> list[UserAdminRead]`
- `depende_de: UserAdminService.list_users`

- `routers.admin_users.get_user_options(...) -> UserAdminOptionsRead`
- `depende_de: UserAdminService.get_options`

- `routers.admin_users.create_user(...) -> MessageResponse`
- `depende_de: UserAdminService.create_user`

- `routers.admin_users.update_user(...) -> MessageResponse`
- `depende_de: UserAdminService.update_user`

- `routers.admin_users.delete_user(...) -> MessageResponse`
- `depende_de: UserAdminService.delete_user`

## 8) Admin catalog

- `routers.admin_catalog.get_catalog_options(...) -> AdminCatalogOptionsRead`
- `depende_de: AdminCatalogService.get_options`

- `routers.admin_catalog.create_company(...) -> MessageResponse`
- `depende_de: AdminCatalogService.create_company`

- `routers.admin_catalog.delete_company(...) -> MessageResponse`
- `depende_de: AdminCatalogService.delete_company`

- `routers.admin_catalog.create_sector(...) -> MessageResponse`
- `depende_de: AdminCatalogService.create_sector`

- `routers.admin_catalog.delete_sector(...) -> MessageResponse`
- `depende_de: AdminCatalogService.delete_sector`

- `routers.admin_catalog.create_document_type(...) -> MessageResponse`
- `depende_de: AdminCatalogService.create_document_type`

- `routers.admin_catalog.delete_document_type(...) -> MessageResponse`
- `depende_de: AdminCatalogService.delete_document_type`

## 9) Repositories

- `DocumentRepository`
  - `create_document`, `list_documents`, `get_document_by_id`, `save`, `delete`
  - `list_companies`, `list_sectors`, `list_document_types`, `list_distinct_document_types`

- `VersionRepository`
  - `create_version`, `save`
  - `list_versions_for_document`, `get_latest_version_for_document`
  - `get_active_version_for_document`, `get_version_by_number`

- `AuthRepository`
  - `get_user_by_email`, `get_user_by_id`

- `UserRepository`
  - CRUD administrativo de usuario + lookup de setor

- `AdminCatalogRepository`
  - CRUD de empresa/setor/tipo documental + contadores de dependencia

## 10) Services de negocio

- `DocumentService`
  - cria documento + versao inicial
  - gera codigo `TIPO-SET-ID`
  - controla submit/aprovacao/reprovacao
  - edita/exclui rascunho do solicitante da criacao

- `VersionService`
  - cria versao em `RASCUNHO`
  - valida unicidade de numero da versao por documento

- `SearchService`
  - retorna documentos vigentes para busca

- `UserAdminService`
  - controle de usuarios (somente admin)

- `AdminCatalogService`
  - controle de empresas/setores/tipos (somente admin)

- `AuditService`
  - `create_placeholder_event(...)` (placeholder, sem persistencia)
