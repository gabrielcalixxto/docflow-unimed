# BACKEND_PROGRESS

## Snapshot atual (2026-03-15)

- Stack: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Login por `username` (nao por email).
- Usuario com multi-acesso:
  - `roles` (lista)
  - `company_ids` (lista)
  - `sector_ids` (lista)
  - campos legados `role/company_id/sector_id` mantidos.
- Catalogo de tipo documental com `sigla` + `name`.
- Setor com `sigla` obrigatoria.
- Upload de arquivos persistido em banco (`stored_files`) via `/file-storage/upload`.
- Eventos de auditoria persistidos em `document_events`.

## Routers ativos

- `auth`
- `documents`
- `versions`
- `search`
- `files`
- `admin_users`
- `admin_catalog`

## Endpoints

Auth:

- `POST /auth/login`

Documents:

- `POST /documents`
- `GET /documents`
- `GET /documents/{document_id}`
- `GET /documents/form-options`
- `PATCH /documents/{document_id}/draft`
- `DELETE /documents/{document_id}/draft`
- `POST /documents/{document_id}/submit-review`
- `POST /documents/{document_id}/approve`
- `POST /documents/{document_id}/reject`

Versions:

- `POST /documents/{document_id}/versions`
- `GET /documents/{document_id}/versions`

Search:

- `GET /documents/search`

Files:

- `POST /file-storage/upload`
- `GET /file-storage/{storage_key}`
- `GET /file-storage/{storage_key}?download=1`

Admin users:

- `GET /admin/users`
- `GET /admin/users/options`
- `POST /admin/users`
- `PUT /admin/users/{user_id}`
- `DELETE /admin/users/{user_id}`

Admin catalog:

- `GET /admin/catalog/options`
- `POST /admin/catalog/companies`
- `PUT /admin/catalog/companies/{company_id}`
- `DELETE /admin/catalog/companies/{company_id}`
- `POST /admin/catalog/sectors`
- `PUT /admin/catalog/sectors/{sector_id}`
- `DELETE /admin/catalog/sectors/{sector_id}`
- `POST /admin/catalog/document-types`
- `PUT /admin/catalog/document-types/{document_type_id}`
- `DELETE /admin/catalog/document-types/{document_type_id}`

## Regras de negocio implementadas

Documento:

- cria codigo automatico `TIPO-SET-ID`
- cria versao inicial `1` em `RASCUNHO`
- cria nova versao com numero automatico (`ultima + 1`)
- bloqueia nova versao se houver versao em andamento.

Fluxo:

- revisor envia: `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO`
- revisor rejeita rascunho: `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO`
- coordenador aprova: `PENDENTE_COORDENACAO/EM_REVISAO -> VIGENTE`
- coordenador reprova: `PENDENTE_COORDENACAO/EM_REVISAO -> REPROVADO`
- versao vigente anterior vira `OBSOLETO` ao aprovar nova vigente.

Permissoes:

- submit para coordenacao: apenas `REVISOR`
- aprovacao final: apenas `COORDENADOR`
- coordenador com setor definido aprova apenas no proprio setor.
- edicao/exclusao de rascunho: apenas autor da criacao.

Datas:

- criacao de documento: vencimento `>= hoje` e `<= hoje + 2 anos`
- criacao de versao: vencimento `>= hoje`
- edicao de rascunho: vencimento `>= hoje`

## Persistencia e entidades

- `companies`
- `sectors`
- `users`
- `document_types`
- `documents`
- `document_versions`
- `document_events`
- `stored_files`

Pontos tecnicos:

- `document_versions` com unique `(document_id, version_number)`
- indice parcial para unica versao `VIGENTE` por documento
- colunas de auditoria de invalidacao em `document_versions`:
  - `invalidated_by`
  - `invalidated_at`.

## Seguranca

- JWT inclui:
  - `sub`, `email`, `user_id`
  - `role`, `roles`
  - `company_id`, `company_ids`
  - `sector_id`, `sector_ids`
  - `exp`.
- Autorizacao principal no service layer.

## Schema / startup

`main.py` aplica `create_all` e ajustes de schema em runtime para compatibilidade:

- enums de status/role
- colunas multi-acesso de usuario
- `document_types.sigla`
- `sectors.sigla`
- colunas de invalidacao em versoes
- migracao de arquivos legados para `stored_files` quando aplicavel.

## Limites atuais

- Sem Alembic versionado no fluxo atual.
- Catalogo no backend exige `ADMIN`; frontend ainda exibe essas telas para `REVISOR`.
- Nao existe endpoint dedicado para consulta de trilha de auditoria por UI (embora eventos sejam persistidos).
