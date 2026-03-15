# ARCHITECTURE

Descricao da arquitetura atual conforme codigo vigente.

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
- `services`: regra de negocio e autorizacao funcional.
- `repositories`: consultas e persistencia SQLAlchemy.
- `models`: entidades ORM.
- `schemas`: contratos Pydantic.
- `core`: config, seguranca, db, logging.

## 3. Entidades e armazenamento

Entidades principais:

- `users`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`
- `stored_files`

Pontos estruturais:

- `documents.document_type` armazenado como string.
- `document_types` possui `sigla` + `name`.
- `sectors` possui `sigla`.
- `users` suporta multi-acesso (`roles`, `company_ids`, `sector_ids`) com campos legados mantidos.
- `document_versions`:
  - unique `(document_id, version_number)`
  - indice parcial para uma unica versao `VIGENTE` por documento (PostgreSQL).
- `stored_files` guarda binario no banco e vinculo opcional a documento/versao.

## 4. Fluxo de versao e aprovacao

Status:

- `RASCUNHO`
- `REVISAR_RASCUNHO`
- `PENDENTE_COORDENACAO`
- `EM_REVISAO` (compatibilidade legada)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes:

- `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO` (revisor envia)
- `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO` (revisor desaprova)
- `PENDENTE_COORDENACAO/EM_REVISAO -> VIGENTE` (coordenador aprova)
- `PENDENTE_COORDENACAO/EM_REVISAO -> REPROVADO` (coordenador reprova)
- `VIGENTE -> OBSOLETO` (nova vigente aprovada)

## 5. Regras de dominio

- Codigo do documento: `TIPO-SET-ID` (tipo + sigla de setor + id).
- Criacao gera versao `1` em `RASCUNHO`.
- Nova versao sempre inicia em `RASCUNHO` com numero automatico.
- Bloqueio de nova versao se ja houver versao em andamento (`RASCUNHO`, `REVISAR_RASCUNHO`, `PENDENTE_COORDENACAO`, `EM_REVISAO`).
- Submit para coordenacao: apenas `REVISOR`.
- Aprovacao/reprovacao final: apenas `COORDENADOR`.
- Coordenador com setores definidos aprova apenas no proprio escopo.
- Edicao/exclusao de rascunho: apenas solicitante da criacao.

Regras de data:

- Criacao de documento: vencimento `>= hoje` e `<= hoje + 2 anos` (backend).
- Criacao de versao: vencimento `>= hoje` (backend).

Normalizacao de cadastros:

- Empresas/setores/tipo(nome): formato titulo, com excecao `de/do/da`.
- Siglas: maiusculas e alfanumericas.
- Palavras explicitamente maiusculas (ex.: `TI`, `CEU`) sao preservadas.

## 6. Frontend

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

Regra de UX:

- Filtros preservam viewport via `frontend/src/hooks/useViewportPreserver.js`.

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

## 8. Observacoes de acesso

- Frontend permite abrir catalogos para `REVISOR` e `ADMIN`.
- Backend de catalogo exige `ADMIN` para operacoes (incluindo `/admin/catalog/options`).

## 9. Limites conhecidos

- RNC ainda em placeholder (`Em breve`).
- Sem migracoes Alembic versionadas no fluxo atual (schema inicializado/ajustado no startup).
- Nao ha tela dedicada para consulta de `document_events`.
