# ARCHITECTURE

Este documento descreve a arquitetura vigente do projeto (estado atual do codigo).

## 1. Visao geral

```text
Frontend (React + Vite)
        |
        v
Backend API (FastAPI)
        |
        v
PostgreSQL
```

Servicos Docker:

- `frontend`
- `backend`
- `postgres`

## 2. Backend por camadas

Estrutura:

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

- `routers`: HTTP + dependencia + translate de erros para status code.
- `services`: regras de negocio e orquestracao.
- `repositories`: persistencia SQLAlchemy.
- `models`: entidades ORM.
- `schemas`: contratos Pydantic de entrada/saida.
- `core`: config, banco, seguranca JWT, seed, logging.

## 3. Modelagem principal

Entidades implementadas:

- `users`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

Observacoes:

- `document_type` e armazenado em `documents` como texto (`string`).
- `document_types` existe como catalogo administrativo para dropdowns e cadastro.
- `document_versions` possui:
  - unicidade `(document_id, version_number)`
  - indice parcial para uma unica versao `VIGENTE` por documento (PostgreSQL).

## 4. Workflow atual

Status em uso:

- `RASCUNHO`
- `EM_REVISAO`
- `VIGENTE`
- `OBSOLETO`

Transicoes aplicadas:

- `RASCUNHO -> EM_REVISAO` (envio para coordenacao)
- `EM_REVISAO -> VIGENTE` (aprovacao)
- `EM_REVISAO -> RASCUNHO` (reprovacao)
- `VIGENTE -> OBSOLETO` (ao promover nova vigente)

## 5. Regras de governanca

- Codigo automatico no formato `TIPO-SET-ID`.
- Criacao de documento gera versao `1` em `RASCUNHO`.
- Solicitante da criacao pode:
  - editar rascunho
  - excluir rascunho
- Restricao de aprovacao para coordenador do mesmo setor (quando setor do coordenador esta definido).

## 6. Permissoes (resumo)

Perfis:

- `AUTOR` (rotulado como `REVISOR` no frontend)
- `COORDENADOR`
- `LEITOR`
- `ADMIN`

Pontos de controle:

- backend valida JWT e permissoes por regra de negocio
- frontend aplica filtros de visibilidade de menu/telas por perfil
- backend e a fonte de verdade para autorizacao

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

## 8. Frontend atual

Stack:

- React 18
- Vite 5
- CSS proprio (`src/index.css`)
- axios para HTTP

Modulos principais:

- busca e visualizacao de vigentes
- criacao/atualizacao de documentos
- central de aprovacao
- historico de solicitacoes com edicao/exclusao de rascunho
- painel de documentos com filtros
- administracao de usuarios e catalogos

## 9. Gaps tecnicos conhecidos

- `AuditService` ainda gera eventos placeholder e nao persiste em `document_events`.
- Nao existe Alembic/migracao versionada; inicializacao usa `Base.metadata.create_all`.
