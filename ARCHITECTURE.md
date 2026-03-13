# ARCHITECTURE

Descricao da arquitetura atual do projeto conforme codigo vigente.

## 1. Topologia

```text
Frontend (React + Vite)
        |
        v
Backend API (FastAPI)
        |
        v
PostgreSQL
```

Containers Docker:

- `frontend`
- `backend`
- `postgres`

## 2. Backend por camadas

```text
backend/
  app/
    core/
    models/
    schemas/
    repositories/
    services/
    routers/
  main.py
```

Responsabilidades:

- `routers`: contrato HTTP, dependencias, translate de excecao para status code.
- `services`: regra de negocio e autorizacao funcional.
- `repositories`: acesso ao banco via SQLAlchemy.
- `models`: entidades ORM.
- `schemas`: contratos Pydantic.
- `core`: config, db, seguranca, logging.

## 3. Modelagem e dados

Entidades:

- `users`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

Pontos estruturais:

- `documents.document_type` permanece string.
- `document_types` e catalogo administrativo separado com:
  - `sigla` (unique)
  - `name` (unique).
- `users` suporta multi-acesso:
  - `roles`, `company_ids`, `sector_ids`
  - com `role/company_id/sector_id` legados mantidos.
- `document_versions`:
  - unique `(document_id, version_number)`
  - indice parcial para uma unica versao `VIGENTE` por documento (PostgreSQL).

## 4. Fluxo de versao

Status:

- `RASCUNHO`
- `EM_REVISAO`
- `VIGENTE`
- `OBSOLETO`

Transicoes:

- `RASCUNHO -> EM_REVISAO` (submit)
- `EM_REVISAO -> VIGENTE` (aprovacao)
- `EM_REVISAO -> RASCUNHO` (reprovacao)
- `VIGENTE -> OBSOLETO` (promocao de nova vigente)

## 5. Regras de dominio

- codigo do documento: `TIPO-SET-ID`.
- criacao de documento gera versao `1` em `RASCUNHO`.
- submit para revisao: apenas `REVISOR`.
- aprovacao/reprovacao: apenas `COORDENADOR`.
- coordenador com setor definido aprova apenas mesmo setor.
- edicao/exclusao de rascunho: apenas solicitante da criacao.

Normalizacao de cadastro:

- empresas/setores/nomes de tipo documental:
  - titulo por palavra
  - `de`, `do`, `da` minusculos quando nao sao primeira palavra.
- sigla de tipo documental:
  - maiuscula
  - apenas alfanumerico.

## 6. Frontend

Stack:

- React 18
- Vite 5
- CSS em `frontend/src/index.css`
- axios para API

Navegacao:

- itens diretos: `Busca`, `Central de Aprovacao`
- grupos colapsaveis:
  - `Solicitacoes`
  - `Painel de Indicadores`
  - `Gestao de Cadastros`

Regra de UX importante:

- filtros devem preservar viewport (posicao de rolagem) durante alteracoes.
- implementado com `frontend/src/hooks/useViewportPreserver.js`.

## 7. Endpoints ativos

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

Admin users:

- `GET /admin/users`
- `GET /admin/users/options`
- `POST /admin/users`
- `PUT /admin/users/{user_id}`
- `DELETE /admin/users/{user_id}`

Admin catalog:

- `GET /admin/catalog/options`
- `POST /admin/catalog/companies`
- `DELETE /admin/catalog/companies/{company_id}`
- `POST /admin/catalog/sectors`
- `DELETE /admin/catalog/sectors/{sector_id}`
- `POST /admin/catalog/document-types`
- `DELETE /admin/catalog/document-types/{document_type_id}`

## 8. Limites conhecidos

- `AuditService` ainda placeholder (sem persistencia real de eventos).
- nao existe fluxo Alembic no projeto atual (schema via `create_all` + ajustes runtime em startup).
