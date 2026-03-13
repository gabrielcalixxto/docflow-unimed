# BACKEND_PROGRESS

## Snapshot atual (2026-03-13)

- Stack: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Driver: `psycopg[binary]`.
- Senha: `bcrypt`.
- Estrutura em camadas consolidada (`core`, `models`, `schemas`, `repositories`, `services`, `routers`).
- API sobe com `create_all`, aplica seed default e registra middleware de logging HTTP.
- Suite de testes backend validada no estado atual.

## Roteadores ativos

- `auth`
- `documents`
- `versions`
- `search`
- `admin_users`
- `admin_catalog`

## Endpoints implementados

### Auth

- `POST /auth/login`

### Documents

- `POST /documents`
- `GET /documents`
- `GET /documents/{document_id}`
- `GET /documents/form-options`
- `PATCH /documents/{document_id}/draft`
- `DELETE /documents/{document_id}/draft`
- `POST /documents/{document_id}/submit-review`
- `POST /documents/{document_id}/approve`
- `POST /documents/{document_id}/reject`

### Versions

- `POST /documents/{document_id}/versions`
- `GET /documents/{document_id}/versions`

### Search

- `GET /documents/search`

### Admin users

- `GET /admin/users`
- `GET /admin/users/options`
- `POST /admin/users`
- `PUT /admin/users/{user_id}`
- `DELETE /admin/users/{user_id}`

### Admin catalog

- `GET /admin/catalog/options`
- `POST /admin/catalog/companies`
- `DELETE /admin/catalog/companies/{company_id}`
- `POST /admin/catalog/sectors`
- `DELETE /admin/catalog/sectors/{sector_id}`
- `POST /admin/catalog/document-types`
- `DELETE /admin/catalog/document-types/{document_type_id}`

## Regras de negocio ja aplicadas

- Criacao de documento:
  - gera codigo `TIPO-SET-ID`
  - cria versao `1` em `RASCUNHO`
- Submit para revisao:
  - `RASCUNHO -> EM_REVISAO`
  - somente perfil `AUTOR`
- Aprovacao:
  - `EM_REVISAO -> VIGENTE`
  - somente `COORDENADOR`/`ADMIN`
  - coordenador com setor definido aprova apenas documentos do mesmo setor
  - versao vigente anterior vira `OBSOLETO`
- Reprovacao:
  - `EM_REVISAO -> RASCUNHO`
- Edicao/exclusao de rascunho:
  - somente solicitante da criacao (`created_by`)
  - somente quando a ultima versao esta em `RASCUNHO`

## Persistencia e modelagem

Entidades:

- `companies`
- `sectors`
- `users`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

Pontos importantes:

- `document_versions` com unicidade `(document_id, version_number)`.
- indice parcial para uma unica versao `VIGENTE` por documento (PostgreSQL).
- seed inclui empresa base, setores base, tipos documentais e usuarios default.

## Seguranca

- JWT com `sub`, `role`, `user_id`, `sector_id`, `exp`.
- Dependencia `get_current_user` valida token e monta contexto autenticado.
- Rotas protegidas validam perfil no service layer.

## Testes

Comando validado:

```bash
python -m pytest -q backend/tests
```

Resultado mais recente:

- `91 passed`
- 1 warning de cache do pytest (`.pytest_cache`), sem impacto funcional

## Gaps conhecidos

- `AuditService` ainda e placeholder (eventos nao persistidos em `document_events`).
- Nao ha Alembic/migracao versionada; inicializacao de schema ainda usa `create_all`.
