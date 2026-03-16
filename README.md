# DocFlow Unimed

Plataforma web para gestao documental com versionamento, fluxo de aprovacao, controle por perfil e trilha de auditoria.

## TL;DR (avaliacao rapida)

1. Copie `.env.example` para `.env`.
2. Suba o ambiente:

```bash
docker compose up -d --build postgres backend frontend
```

3. Acesse:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

4. Banco vazio? Crie o primeiro admin (secao [Primeiro acesso sem seed](#primeiro-acesso-sem-seed)).

## O que o sistema entrega

- Cadastro e busca de documentos.
- Criacao de versoes sem sobrescrever historico anterior.
- Fluxo de aprovacao por papel (`COORDENADOR/APROVADOR` e `QUALIDADE`).
- Visibilidade por escopo (`CORPORATIVO` e `LOCAL`).
- Upload e download de arquivos salvos no banco (`stored_files`).
- Auditoria de eventos do fluxo (`document_events`) e auditoria geral (`audit_logs` + `audit_log_changes`).

## Stack e arquitetura

- Frontend: React 18 + Vite 5
- Backend: FastAPI + SQLAlchemy
- Banco: PostgreSQL 16
- Auth: JWT Bearer
- Infra local: Docker Compose

```text
Frontend (React/Vite) -> Backend API (FastAPI) -> PostgreSQL
```

Estrutura backend:

```text
backend/app/
  core/ models/ schemas/ repositories/ services/ routers/
```

## Como executar com Docker

### Pre-requisitos

- Docker + Docker Compose instalados.

### Passos

1. Configure variaveis:

```bash
cp .env.example .env
```

2. Suba os servicos:

```bash
docker compose up -d --build postgres backend frontend
```

3. Verifique healthcheck:

```bash
curl http://localhost:8000/health
```

## Primeiro acesso sem seed

O projeto nao usa seed automatica. Se o banco estiver vazio, crie 1 usuario admin manualmente.

1. Gere hash da senha:

```bash
docker compose exec backend python
```

No prompt Python:

```python
from app.core.security import hash_password
print(hash_password("Admin@123"))
```

2. Entre no Postgres:

```bash
docker compose exec -it postgres psql -U postgres -d docflow
```

3. Execute SQL (substitua `<HASH_BCRYPT>`):

```sql
INSERT INTO users (name, username, email, password_hash, role, roles, company_ids, sector_ids)
VALUES ('Admin DocFlow', 'admin', 'admin@docflow.local', '<HASH_BCRYPT>', 'ADMIN', '["ADMIN"]'::jsonb, '[]'::jsonb, '[]'::jsonb);
```

## Fluxo documental e regras

Status usados:

- `RASCUNHO`
- `RASCUNHO_REVISADO`
- `REVISAR_RASCUNHO`
- `PENDENTE_QUALIDADE`
- `PENDENTE_COORDENACAO` (legado)
- `EM_REVISAO` (legado)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes principais:

- `AUTOR`: cria documento em `RASCUNHO`.
- `COORDENADOR/APROVADOR`: aprova `RASCUNHO/REVISAR_RASCUNHO/RASCUNHO_REVISADO` e move para `PENDENTE_QUALIDADE`.
- `COORDENADOR/APROVADOR`: reprova rascunho e move para `REVISAR_RASCUNHO`.
- `AUTOR`: ao editar `REVISAR_RASCUNHO`, o status muda para `RASCUNHO_REVISADO`.
- `QUALIDADE` (role tecnico `REVISOR`): aprova `PENDENTE_QUALIDADE` e torna `VIGENTE`.
- `QUALIDADE` (role tecnico `REVISOR`): reprova `PENDENTE_QUALIDADE` e move para `REPROVADO`.
- Nova versao `VIGENTE` torna a vigente anterior `OBSOLETO`

Regras importantes:

- Busca (`/documents/search`) retorna apenas versao `VIGENTE` visivel ao usuario.
- So existe uma versao `VIGENTE` por documento (indice parcial no banco).
- Codigo automatico: `TIPO-SETOR-ID`.
- Validade de vencimento:
  - Criacao de documento: `>= hoje` e `<= hoje + 2 anos`
  - Criacao/edicao de versao: `>= hoje`
- Siglas de setor e tipo documental sao obrigatorias, maiusculas e alfanumericas.

## Perfis e permissoes

| Perfil | Busca | Novo Documento / Criar versao | Historico Solicitacoes | Central Aprovacao | Painel Documentos | Cadastros (empresa/setor/tipo) | Cadastro Usuarios | Historico Acoes |
|---|---|---|---|---|---|---|---|---|
| LEITOR | Sim | Nao | Nao | Nao | Nao | Nao | Nao | Nao |
| AUTOR | Sim | Sim | Sim | Nao | Nao | Nao | Nao | Nao |
| QUALIDADE (`REVISOR`) | Sim | Nao | Nao | Sim | Sim | Sim | Nao | Nao |
| COORDENADOR/APROVADOR (`COORDENADOR`) | Sim | Nao | Nao | Sim | Nao | Nao | Nao | Sim (somente setor) |
| ADMIN | Sim | Nao | Nao | Nao | Nao | Sim | Sim | Sim (todos setores) |

Regras de backend relevantes:

- Criar documento, editar/excluir rascunho e criar nova versao: apenas `AUTOR`.
- Aprovar/reprovar etapa de rascunho: apenas `COORDENADOR`.
- Aprovar/reprovar etapa de qualidade: apenas `REVISOR` (nome funcional: `QUALIDADE`).
- Gestao de usuarios: apenas `ADMIN`.
- Gestao de catalogos: `ADMIN` e `REVISOR`.
- Historico de acoes (`/audit/events`): `ADMIN` (global) e `COORDENADOR` (apenas documentos do proprio setor).

## Documentacao da API (Swagger/OpenAPI)

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints principais

Auth:
- `POST /auth/login`
- `POST /auth/refresh`

Documents:
- `POST /documents`
- `GET /documents`
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

Admin:
- `GET/POST/PUT/DELETE /admin/users...`
- `GET/POST/PUT/DELETE /admin/catalog...`
- `GET /audit/events`

## Como rodar testes

Backend (local):

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Backend (container):

```bash
docker compose exec -T backend pip install -r requirements-dev.txt
docker compose exec -T backend python -m pytest -q tests
```

Frontend (build):

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

## Estrutura do repositorio

```text
.
|-- backend/
|   |-- app/
|   |-- tests/
|   `-- main.py
|-- frontend/src/
|   |-- components/
|   |-- hooks/
|   |-- pages/
|   |-- services/
|   `-- utils/
|-- docker-compose.yml
`-- README.md
```

## Limites atuais

- Modulos de RNC ainda estao em placeholder (`Em breve`).
- Nao ha migracoes Alembic versionadas; o startup aplica ajustes de schema para compatibilidade.

## Documentos complementares

- `ARCHITECTURE.md`
- `ResumoFuncionalidades.md`
- `AI_INSTRUCTIONS.md`

