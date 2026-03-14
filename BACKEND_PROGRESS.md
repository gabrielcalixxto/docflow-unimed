# BACKEND_PROGRESS

## Snapshot atual (2026-03-13)

- Stack: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Login por `username` (nao por email).
- Controle de acesso multi-escopo em usuario:
  - `roles` (lista)
  - `company_ids` (lista)
  - `sector_ids` (lista)
  - com campos legados `role/company_id/sector_id` mantidos para compatibilidade.
- Catalogo de tipo documental com:
  - `sigla` (unica, maiuscula, alfanumerica)
  - `name` (nome normalizado).
- Inicializacao em `main.py` aplica ajustes de schema em runtime para:
  - `users` multi-acesso
  - `document_types.sigla`
  - `sectors.sigla`
  - valores novos do enum `document_status`.

## Routers ativos

- `auth`
- `documents`
- `versions`
- `search`
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
- `PUT /admin/catalog/companies/{company_id}`
- `POST /admin/catalog/sectors`
- `DELETE /admin/catalog/sectors/{sector_id}`
- `PUT /admin/catalog/sectors/{sector_id}`
- `POST /admin/catalog/document-types`
- `DELETE /admin/catalog/document-types/{document_type_id}`
- `PUT /admin/catalog/document-types/{document_type_id}`

## Regras de negocio implementadas

Documento:

- cria codigo automatico `TIPO-SET-ID`
- cria versao inicial `1` em `RASCUNHO`.
- nova versao cria numero automaticamente (`ultima + 1`).
- bloqueia nova criacao quando ja existe versao em andamento.

Fluxo:

- envio/aprovacao de revisor: `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO`
- desaprovacao de revisor: `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO`
- aprovacao coordenacao: `PENDENTE_COORDENACAO -> VIGENTE`
- reprovacao coordenacao: `PENDENTE_COORDENACAO -> REPROVADO`
- ao aprovar nova versao, vigente anterior vira `OBSOLETO`.
- `EM_REVISAO` e aceito apenas para compatibilidade legada.

Controle de dono do rascunho:

- editar/excluir apenas se:
  - usuario atual e `created_by`
  - ultima versao esta em `RASCUNHO` ou `REVISAR_RASCUNHO`.

Restricao de aprovacao por setor:

- coordenador com setor configurado aprova apenas documento do mesmo setor.

Normalizacao de cadastro administrativo:

- empresas e setores:
  - formato titulo por palavra
  - `de`, `do`, `da` permanecem minusculos quando nao sao primeira palavra.
- tipo documental:
  - `sigla` -> maiuscula e alfanumerica
  - `name` -> mesmo padrao de titulo das empresas/setores.

## Persistencia e entidades

- `companies`
- `sectors`
- `users`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

Pontos tecnicos:

- `document_versions` com unique `(document_id, version_number)`.
- indice parcial para uma unica versao `VIGENTE` por documento (PostgreSQL).

## Seguranca

- JWT carrega:
  - `sub`, `email`, `user_id`
  - `role`, `roles`
  - `company_id`, `company_ids`
  - `sector_id`, `sector_ids`
  - `exp`.
- autorizacao principal ocorre no service layer.

## Testes

Comando:

```bash
python -m pytest -q backend/tests
```

Resultado validado mais recente:

- `110 passed`
- 1 warning de cache do pytest, sem impacto funcional.

## Limites conhecidos

- `AuditService` segue como placeholder (sem persistencia real em `document_events`).
- nao ha Alembic no fluxo atual; schema inicia via `create_all` + ajustes runtime.
