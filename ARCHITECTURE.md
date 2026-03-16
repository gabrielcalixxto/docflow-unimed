# ARCHITECTURE

Fonte principal de arquitetura e estado tecnico do backend/frontend.

Este arquivo substitui o antigo `BACKEND_PROGRESS.md` para evitar duplicacao.

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

- `routers`: contrato HTTP, dependencias e mapeamento de erro.
- `services`: regras de negocio e autorizacao funcional.
- `repositories`: consultas e persistencia SQLAlchemy.
- `models`: entidades ORM.
- `schemas`: contratos Pydantic.
- `core`: config, seguranca, db, logging e contexto de auditoria.

## 3. Snapshot tecnico atual

- Stack backend: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Login por `username` (nao por email).
- Sessao pode ser atualizada via `POST /auth/refresh` para refletir permissoes sem relogin manual.
- Usuario com multi-acesso:
  - `roles` (lista)
  - `company_ids` (lista)
  - `sector_ids` (lista)
  - campos legados `role/company_id/sector_id` mantidos.
- Catalogos com sigla:
  - `document_types.sigla` obrigatoria
  - `sectors.sigla` obrigatoria.
- Upload de arquivos persistido em banco (`stored_files`) via `/file-storage/upload`.
- Auditoria:
  - eventos de fluxo em `document_events`
  - trilha geral em `audit_logs` + `audit_log_changes`.

## 4. Entidades e armazenamento

Entidades principais:

- `users`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`
- `stored_files`
- `audit_logs`
- `audit_log_changes`

Pontos estruturais:

- `documents.document_type` armazenado como string.
- `document_types` possui `sigla` + `name`.
- `sectors` possui `sigla`.
- `users` suporta multi-acesso (`roles`, `company_ids`, `sector_ids`).
- `document_versions`:
  - unique `(document_id, version_number)`
  - indice parcial para unica versao `VIGENTE` por documento (PostgreSQL).
- `document_versions` tambem possui:
  - `invalidated_by`
  - `invalidated_at`.
- `stored_files` guarda binario no banco com vinculo opcional a documento/versao.

## 5. Fluxo de versao e aprovacao

Status:

- `RASCUNHO`
- `RASCUNHO_REVISADO`
- `REVISAR_RASCUNHO`
- `PENDENTE_QUALIDADE`
- `PENDENTE_COORDENACAO` (legado)
- `EM_REVISAO` (compatibilidade legada)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes:

- `AUTOR` cria documento/versao em `RASCUNHO`.
- `COORDENADOR/APROVADOR` aprova rascunho e move para `PENDENTE_QUALIDADE`.
- `COORDENADOR/APROVADOR` reprova rascunho e move para `REVISAR_RASCUNHO`.
- Ao editar um `REVISAR_RASCUNHO`, o sistema move para `RASCUNHO_REVISADO`.
- `QUALIDADE` (role tecnico `REVISOR`) aprova `PENDENTE_QUALIDADE` e move para `VIGENTE`.
- `QUALIDADE` (role tecnico `REVISOR`) reprova `PENDENTE_QUALIDADE` e move para `REPROVADO`.
- `VIGENTE -> OBSOLETO` (nova versao vigente aprovada)

## 6. Regras de dominio

- Codigo do documento: `TIPO-SET-ID` (tipo + sigla de setor + id).
- Criacao gera versao `1` em `RASCUNHO`.
- Nova versao sempre inicia em `RASCUNHO` com numero automatico.
- Bloqueio de nova versao se ja houver versao em andamento (`RASCUNHO`, `RASCUNHO_REVISADO`, `REVISAR_RASCUNHO`, `PENDENTE_QUALIDADE`, `PENDENTE_COORDENACAO`, `EM_REVISAO`).
- Criacao/edicao de rascunho e criacao de versao: apenas `AUTOR`.
- Aprovacao/reprovacao de rascunho: apenas `COORDENADOR`.
- Aprovacao/reprovacao da etapa de qualidade: apenas `REVISOR` (nome funcional `QUALIDADE`).
- Coordenador com setores definidos aprova/reprova somente no proprio escopo.
- Edicao/exclusao de rascunho: apenas solicitante da criacao.

Regras de data:

- Criacao de documento: vencimento `>= hoje` e `<= hoje + 2 anos`.
- Criacao de versao: vencimento `>= hoje`.
- Edicao de rascunho: vencimento `>= hoje`.

Normalizacao de cadastros:

- Empresas/setores/tipo(nome): formato titulo, com excecao `de/do/da`.
- Siglas: maiusculas e alfanumericas.
- Palavras explicitamente maiusculas (ex.: `TI`, `CEU`) sao preservadas.

## 7. Seguranca

- JWT inclui:
  - `sub`, `email`, `user_id`
  - `role`, `roles`
  - `company_id`, `company_ids`
  - `sector_id`, `sector_ids`
  - `exp`.
- Autorizacao principal no service layer.

## 8. Schema e inicializacao

No startup, `main.py` aplica `create_all` e ajustes de compatibilidade em runtime:

- enums de status e role
- colunas de multi-acesso em `users`
- `document_types.sigla`
- `sectors.sigla` e sincronizacao de codigos
- colunas de invalidacao em `document_versions`
- estrutura de auditoria (`audit_logs`/`audit_log_changes`)
- migracao de arquivos legados para `stored_files` quando aplicavel.

## 9. Frontend

Stack:

- React 18
- Vite 5
- CSS em `frontend/src/index.css`

Navegacao:

- itens diretos: `Busca`, `Central de Aprovacao`
- grupos:
  - `Solicitacoes` (`Novo Documento`, `Historico de Solicitacoes`, `Nova RNC (Em breve)`)
  - `Painel de Indicadores` (`Painel de Documentos`, `Painel de RNC (Em breve)`)
  - `Gestao de Cadastros`
  - `Historico de Acoes` (`ADMIN` global e `COORDENADOR` por setor)

Regra de UX:

- filtros preservam viewport via `frontend/src/hooks/useViewportPreserver.js`.

## 10. Endpoints ativos

Auth:

- `POST /auth/login`
- `POST /auth/refresh`

Documents:

- `POST /documents`
- `GET /documents`
- `GET /documents/form-options`
- `GET /documents/workflow`
- `GET /documents/{document_id}`
- `GET /documents/{document_id}/events`
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

Audit:

- `GET /audit/events`

## 11. Observacoes de acesso

- Catalogo (`/admin/catalog`) permite `ADMIN` e `REVISOR` (nome funcional `QUALIDADE`).
- Gestao de usuarios exige `ADMIN`.
- Historico de acoes:
  - `ADMIN` ve todos os setores.
  - `COORDENADOR` ve apenas eventos ligados a documentos do proprio setor.

## 12. Limites conhecidos

- RNC ainda em placeholder (`Em breve`).
- Sem migracoes Alembic versionadas no fluxo atual (schema inicializado/ajustado no startup).
