# CALIXTO Backend Map (Interface)

Panorama rapido por funcionalidade, no formato:

- `assinatura`
- `depende_de`

## 1) Bootstrap API

- `main.lifespan(app: FastAPI)`
- `depende_de: Base.metadata.create_all, seed_default_users`

- `main.healthcheck() -> dict[str, str]`
- `depende_de: sem dependencia de negocio`

## 2) Core (config, db, logging)

- `core.config.Settings`
- `depende_de: pydantic-settings, arquivo .env`

- `core.config.get_settings() -> Settings`
- `depende_de: Settings`

- `core.database.get_db() -> Generator[Session, None, None]`
- `depende_de: SessionLocal (engine SQLAlchemy)`

- `core.logging_config.configure_logging(level: str) -> None`
- `depende_de: logging, settings.log_level`

- `core.logging_config.RequestResponseLoggingMiddleware.dispatch(request, call_next) -> Response`
- `depende_de: FastAPI middleware stack, logger`

## 3) Seed inicial

- `core.seed.seed_default_users() -> None`
- `depende_de: SessionLocal, User, hash_password, settings.seed_default_users`

## 4) Auth + Security

- `routers.auth.get_auth_service(db: Session) -> AuthService`
- `depende_de: AuthRepository`

- `routers.auth.login(payload: LoginRequest, service: AuthService) -> TokenResponse`
- `depende_de: AuthService.login`

- `services.auth.AuthService.login(payload: LoginRequest) -> TokenResponse`
- `depende_de: AuthRepository.get_user_by_email, verify_password, create_access_token`

- `repositories.auth.AuthRepository.get_user_by_email(email: str) -> User | None`
- `depende_de: Session.execute(select(User))`

- `core.security.hash_password(password: str) -> str`
- `depende_de: bcrypt.hashpw`

- `core.security.verify_password(plain_password: str, hashed_password: str) -> bool`
- `depende_de: bcrypt.checkpw`

- `core.security.create_access_token(subject: str, role: UserRole, user_id: int | None) -> str`
- `depende_de: jose.jwt.encode, settings.jwt_secret_key, settings.jwt_algorithm`

- `core.security.get_current_user(token: str) -> AuthenticatedUser`
- `depende_de: oauth2_scheme, jose.jwt.decode, UserRole`

## 5) Documents

- `routers.documents.get_document_service(db: Session) -> DocumentService`
- `depende_de: DocumentRepository, VersionRepository, AuthRepository, AuditService`

- `routers.documents.create_document(...) -> MessageResponse`
- `depende_de: DocumentService.create_document`

- `routers.documents.list_documents(...) -> list[DocumentRead]`
- `depende_de: DocumentService.list_documents`

- `routers.documents.get_document(document_id: int, ...) -> DocumentRead`
- `depende_de: DocumentService.get_document`

- `routers.documents.submit_review(...) -> MessageResponse`
- `depende_de: DocumentService.submit_for_review`

- `routers.documents.approve_document(...) -> MessageResponse`
- `depende_de: DocumentService.approve_document`

- `services.document.DocumentService.create_document(...) -> MessageResponse`
- `depende_de: DocumentRepository.create_document, AuditService.create_placeholder_event, db.commit`

- `services.document.DocumentService.list_documents() -> list[Document]`
- `depende_de: DocumentRepository.list_documents`

- `services.document.DocumentService.get_document(document_id: int) -> Document | None`
- `depende_de: DocumentRepository.get_document_by_id`

- `services.document.DocumentService.submit_for_review(...) -> MessageResponse`
- `depende_de: DocumentRepository.get_document_by_id, VersionRepository.get_latest_version_for_document, VersionRepository.save, AuditService.create_placeholder_event, db.commit`

- `services.document.DocumentService.approve_document(...) -> MessageResponse`
- `depende_de: AuthRepository.get_user_by_id, VersionRepository.get_latest_version_for_document, VersionRepository.get_active_version_for_document, VersionRepository.save, AuditService.create_placeholder_event, db.commit`

- `repositories.document.DocumentRepository.list_documents() -> list[Document]`
- `depende_de: select(Document).order_by(created_at.desc())`

- `repositories.document.DocumentRepository.get_document_by_id(document_id: int) -> Document | None`
- `depende_de: select(Document).where(Document.id == document_id)`

## 6) Versions

- `routers.versions.get_version_service(db: Session) -> VersionService`
- `depende_de: VersionRepository, DocumentRepository, AuditService`

- `routers.versions.create_version(...) -> MessageResponse`
- `depende_de: VersionService.create_version`

- `routers.versions.list_versions(...) -> list[DocumentVersionRead]`
- `depende_de: VersionService.list_versions`

- `services.version.VersionService.create_version(...) -> MessageResponse`
- `depende_de: DocumentRepository.get_document_by_id, VersionRepository.get_version_by_number, VersionRepository.create_version, AuditService.create_placeholder_event, db.commit`

- `services.version.VersionService.list_versions(document_id: int) -> list[DocumentVersion]`
- `depende_de: VersionRepository.list_versions_for_document`

- `repositories.version.VersionRepository.list_versions_for_document(document_id: int) -> list[DocumentVersion]`
- `depende_de: select(DocumentVersion).where(document_id).order_by(version_number.desc())`

## 7) Search

- `routers.search.get_search_service(db: Session) -> SearchService`
- `depende_de: SearchRepository`

- `routers.search.search_documents(...) -> DocumentSearchResponse`
- `depende_de: SearchService.search_documents`

- `services.search.SearchService.search_documents() -> DocumentSearchResponse`
- `depende_de: SearchRepository.search_active_documents, DocumentSearchResult`

- `repositories.search.SearchRepository.search_active_documents() -> list[tuple[Document, DocumentVersion]]`
- `depende_de: join(Document, DocumentVersion), filtro DocumentStatus.VIGENTE`

## 8) Audit

- `services.audit.AuditService.create_placeholder_event(...) -> dict`
- `depende_de: DocumentEventType`

## 9) Modelos ORM (entidades)

- `models.Company`
- `depende_de: Base, relacao com Sector e Document`

- `models.Sector`
- `depende_de: Base, FK company_id`

- `models.User`
- `depende_de: Base, UserRole, FK sector_id`

- `models.Document`
- `depende_de: Base, DocumentScope, FK company_id/sector_id/owner_user_id`

- `models.DocumentVersion`
- `depende_de: Base, DocumentStatus, FK document_id/reviewer_id/approver_id`

- `models.DocumentEvent`
- `depende_de: Base, DocumentEventType, FK document_id/version_id/user_id`
