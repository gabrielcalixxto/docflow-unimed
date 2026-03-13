# DocFlow Unimed

Plataforma web para controle de documentos com versionamento, fluxo de aprovacao e segregacao por perfil/setor.

## O que ja funciona hoje

- Login com JWT.
- Busca de documentos vigentes.
- Criacao de documento com:
  - codigo automatico no formato `TIPO-SET-ID` (ex.: `POP-ENF-8`)
  - versao `1` criada automaticamente em `RASCUNHO`.
- Atualizacao de documento via criacao de nova versao.
- Fluxo de aprovacao:
  - `RASCUNHO -> EM_REVISAO -> VIGENTE`
  - rejeicao volta para `RASCUNHO`.
- Historico de solicitacoes do usuario logado (criacao e atualizacao).
- Edicao/exclusao de solicitacao em rascunho pelo solicitante da criacao.
- Painel de documentos com filtros.
- Painel de usuarios (admin).
- Cadastro de empresas, setores e tipos documentais (admin).
- Painel de RNC como placeholder (tela em branco).

## Stack atual

- Frontend: React + Vite + CSS (sem dependencia de design system externo)
- Backend: FastAPI + SQLAlchemy
- Banco: PostgreSQL
- Auth: JWT Bearer Token
- Containers: Docker Compose (`frontend`, `backend`, `postgres`)

## Perfis e permissoes (resumo)

- `AUTOR` (exibido no front como `REVISOR`):
  - cria documentos/versoes
  - pode enviar para etapa de coordenacao
- `COORDENADOR`:
  - aprova/reprova documentos em revisao
  - restricao por setor quando aplicavel
- `LEITOR`:
  - leitura e busca
- `ADMIN`:
  - acesso administrativo (usuarios + catalogos)
  - visao operacional ampla

## Menu do frontend

- `Busca`
- `Solicitacoes`
  - `Novo Documento`
  - `Atualizar Documento`
  - `Central de Aprovacao`
  - `Historico de Solicitacoes`
- `Painel de Indicadores`
  - `Painel de Documentos`
  - `Painel de RNC` (placeholder)
- `Gestao de acessos` (admin)
  - `Painel de Usuarios`
  - `Cadastro de Setores`
  - `Cadastro de Empresas`
  - `Cadastro Tipo de Documento`

## Endpoints principais

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

## Como rodar com Docker

1. Copie `.env.example` para `.env` e ajuste os valores.
2. Suba os servicos:

```bash
docker compose up --build
```

3. Acesse:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/health`

## Usuarios seed (quando `SEED_DEFAULT_USERS=true`)

- `admin@teste.com` (`ADMIN`)
- `coord@teste.com` (`COORDENADOR`)
- `autor@teste.com` (`AUTOR` exibido como `REVISOR`)
- `leitor@teste.com` (`LEITOR`)

Senha default: valor de `SEED_DEFAULT_PASSWORD` (padrao `123`).

## Testes

Backend:

```bash
python -m pip install -r backend/requirements-dev.txt
python -m pytest -q backend/tests
```

Frontend (build):

```bash
npm --prefix frontend run build
```

## Limites conhecidos

- Eventos de auditoria ainda estao em modo placeholder (`AuditService`) e nao persistem em `document_events`.
- Banco ainda usa `create_all` no startup; nao ha migracoes versionadas (Alembic) no fluxo atual.
