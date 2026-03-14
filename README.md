# DocFlow Unimed

Plataforma web para controle documental com versionamento, fluxo de aprovacao e controle de acesso por perfil.

## Estado atual

- Login por `username` com JWT.
- Cadastro de documento cria automaticamente:
  - codigo `TIPO-SET-ID` (ex.: `POP-ENF-8`)
  - versao `1` em `RASCUNHO`.
- Atualizacao de documento por nova versao com numero automatico (`ultima + 1`).
- Fluxo operacional:
  - revisor aprova: `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO`
  - revisor desaprova: `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO`
  - coordenador aprova: `PENDENTE_COORDENACAO -> VIGENTE`
  - coordenador reprova: `PENDENTE_COORDENACAO -> REPROVADO`
  - quando nova versao vira vigente, a vigente anterior vai para `OBSOLETO`.
- `EM_REVISAO` permanece apenas por compatibilidade com estados legados.
- Historico de solicitacoes do solicitante (criacao + atualizacao).
- Edicao e exclusao de rascunho apenas pelo solicitante da criacao.
- Painel de documentos com filtros por status considerando todas as versoes.
- Gestao de usuarios com multiplo papel, empresa e setor.
- Cadastros administrativos:
  - empresas
  - setores
  - tipos documentais com `sigla` + `nome`.
- Painel de RNC placeholder (tela em branco).

## Regra de UX para filtros

Todos os filtros existentes no frontend devem preservar a posicao atual da pagina (viewport) durante a alteracao do filtro e durante recargas relacionadas ao filtro.

Implementacao atual:

- `SearchPage`
- `PainelDocumentos`
- `CadastroSetores`

Hook utilizado:

- `frontend/src/hooks/useViewportPreserver.js`

## Stack

- Frontend: React + Vite + CSS
- Backend: FastAPI + SQLAlchemy
- Banco: PostgreSQL
- Auth: JWT Bearer
- Containers: Docker Compose (`frontend`, `backend`, `postgres`)

## Perfis e acesso no frontend

Regras ativas em `frontend/src/utils/roles.js`:

- `LEITOR`
  - acesso: busca
- `AUTOR`
  - acesso: novo documento, atualizar documento, historico
- `REVISOR`
  - acesso: novo documento, atualizar documento, historico, central de aprovacao, painel de documentos/RNC, catalogos administrativos
- `COORDENADOR`
  - acesso: novo documento, atualizar documento, historico, central de aprovacao
- `ADMIN`
  - acesso: busca, cadastro de usuarios e catalogos administrativos

## Menu lateral

- `Busca` (item direto)
- `Central de Aprovacao` (item direto)
- Grupo `Solicitacoes`
  - `Novo Documento`
  - `Atualizar Documento`
  - `Historico de Solicitacoes`
- Grupo `Painel de Indicadores`
  - `Painel de Documentos`
  - `Painel de RNC`
- Grupo `Gestao de Cadastros`
  - `Cadastro de Usuarios`
  - `Cadastro de Setores`
  - `Cadastro de Empresas`
  - `Cadastro Tipo de Documento`

## Endpoints principais

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

## Cadastros e normalizacao

Empresas e setores:

- normalizacao tipo titulo por palavra
- excecao: `de`, `do`, `da` ficam minusculas quando nao sao a primeira palavra.

Tipos documentais:

- `sigla`: sempre maiuscula, apenas alfanumerico
- `nome`: normalizacao tipo titulo com excecao `de/do/da`.

## Como rodar com Docker

1. Copie `.env.example` para `.env`.
2. Execute:

```bash
docker compose up -d --build postgres backend frontend
```

3. Acesse:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/health`

## Testes

Backend:

```bash
python -m pytest -q backend/tests
```

Frontend:

```bash
npm --prefix frontend run build
```

## Limites atuais

- `AuditService` ainda usa evento placeholder (sem persistencia real em `document_events`).
- Schema ainda inicializa com `create_all`; nao ha migracao Alembic versionada no fluxo atual.
