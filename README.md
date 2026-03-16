# DocFlow Unimed

Plataforma web para gestao documental com versionamento, fluxo de aprovacao, controle por perfil e trilha de auditoria.

## Estado atual (16/03/2026)

- Backend: testes automatizados executados com sucesso (`149 passed`).
- Frontend: build de producao executado com sucesso (`vite build`).
- Regra de visibilidade:
  - `LOCAL`: visivel apenas para usuarios com setor liberado.
  - `CORPORATIVO`: visivel para todos os usuarios autenticados.

## TL;DR

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
- Fluxo de aprovacao centralizado em `COORDENADOR`.
- Visibilidade por escopo (`CORPORATIVO` e `LOCAL`).
- Upload e download de arquivos salvos no banco (`stored_files`).
- Auditoria de eventos de fluxo (`document_events`) e auditoria geral (`audit_logs` + `audit_log_changes`).
- Gestao de usuarios com inativacao (`is_active`) e reativacao.
- Primeiro login com troca obrigatoria de senha (`must_change_password`) com bloqueio server-side das demais rotas ate a alteracao.
- Paginacao com seletor de linhas por pagina nas telas tabulares.

## Guia de uso da ferramenta (usuario final)

### 1. Login

- Acesse a tela de login e informe `login` e `senha`.
- Se o usuario estiver com `must_change_password = true`, o backend permite apenas:
  - `POST /auth/change-password`
  - `POST /auth/refresh`
- Enquanto a senha nao for trocada, as demais rotas ficam bloqueadas (inclusive acesso a arquivo e websocket).

### 2. Fluxo principal

1. `AUTOR` cria documento em `Novo Documento`.
2. `AUTOR` envia para revisao (status vai para `REVISAR_RASCUNHO`).
3. `COORDENADOR` aprova (`VIGENTE`) ou devolve para ajuste (`REVISAR_RASCUNHO`) ou reprova definitivo (`REPROVADO`).
4. Nova versao aprovada torna a versao vigente anterior `OBSOLETO`.

### 3. Escopo e visibilidade

- Documento `CORPORATIVO`: aparece para qualquer usuario autenticado.
- Documento `LOCAL`: aparece somente para quem tem o setor do documento liberado.

### 4. Painel de usuarios

- Botao `Inativar` troca para `Reativar` apos inativacao.
- `Editar` (azul claro), `Inativar` (vermelho/rosa claro), `Reativar` (cinza claro).

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
- `PENDENTE_COORDENACAO` (legado)
- `EM_REVISAO` (legado)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes principais:

- `AUTOR`: cria documento em `RASCUNHO`.
- `COORDENADOR` (`POST /documents/{id}/submit-review`): move para `REVISAR_RASCUNHO`.
- `COORDENADOR` (`POST /documents/{id}/approve`): aprova e move para `VIGENTE`.
- `COORDENADOR` (`POST /documents/{id}/reject`): devolve para ajuste e move para `REVISAR_RASCUNHO`.
- `COORDENADOR` (`POST /documents/{id}/reject-definitive`): reprova definitivo e move para `REPROVADO`.
- `AUTOR`: ao editar `REVISAR_RASCUNHO`, o status muda para `RASCUNHO_REVISADO`.
- Nova versao `VIGENTE` torna a vigente anterior `OBSOLETO`.

Regras importantes:

- Busca (`/documents/search`) retorna apenas versao `VIGENTE` visivel ao usuario.
- So existe uma versao `VIGENTE` por documento (indice parcial no banco).
- Codigo automatico: `TIPO-SETOR-ID`.
- Validade de vencimento:
  - Criacao de documento: `>= hoje` e `<= hoje + 2 anos`
  - Criacao/edicao de versao: `>= hoje`
- Siglas de setor e tipo documental sao obrigatorias, maiusculas e alfanumericas.

Regras de usuario/login:

- Novo usuario nasce `is_active = true` e `must_change_password = true`.
- Usuarios inativos nao autenticam.
- Troca de senha exige senha atual + nova senha + confirmacao, com complexidade minima (8 caracteres, numero e caractere especial).
- Com `must_change_password = true`, backend bloqueia as demais rotas.

## Perfis e permissoes

| Perfil | Busca | Novo Documento / Criar versao | Historico Solicitacoes | Central Aprovacao | Painel Documentos | Cadastros (empresa/setor/tipo) | Cadastro Usuarios | Historico Acoes |
|---|---|---|---|---|---|---|---|---|
| LEITOR | Sim | Nao | Nao | Nao | Nao | Nao | Nao | Nao |
| AUTOR | Sim | Sim | Sim | Nao | Nao | Nao | Nao | Nao |
| REVISOR (INATIVO) | Sim | Nao | Nao | Nao | Nao | Nao | Nao | Nao |
| COORDENADOR | Sim | Nao | Nao | Sim | Sim | Nao | Nao | Sim (somente setor) |
| ADMIN | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim (todos setores) |

Regras de backend relevantes:

- Criar documento, editar/excluir rascunho e criar nova versao: `AUTOR` (e `ADMIN` por heranca de papel).
- Aprovar/reprovar versoes: `COORDENADOR` (e `ADMIN` por heranca de papel).
- Gestao de usuarios: apenas `ADMIN`.
- Gestao de catalogos: apenas `ADMIN`.
- Historico de acoes (`/audit/events`): `ADMIN` (global) e `COORDENADOR` (somente documentos do proprio setor).

## Documentacao da API (Swagger/OpenAPI)

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints principais

Auth:
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/change-password`

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
- `POST /documents/{document_id}/reject-definitive`

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
- `PATCH /admin/users/{user_id}/inactivate`
- `PATCH /admin/users/{user_id}/reactivate`
- `GET/POST/PUT/DELETE /admin/catalog...`
- `GET /audit/events`

Realtime:
- `GET ws://localhost:8000/ws/events`

## Scripts de manutencao de dados

Executar no container `backend`:

```bash
docker compose exec -T backend python scripts/validate_and_fill_demo_data.py
docker compose exec -T backend python scripts/replace_all_pdfs_with_reference.py
docker compose exec -T backend python -m scripts.backfill_comment_authors_from_audit
```

- `validate_and_fill_demo_data.py`: valida logins/arquivos e preenche faltantes com dados ficticios para demonstracao.
- `replace_all_pdfs_with_reference.py`: substitui o conteudo de todos os PDFs pelo documento de referencia `MAN-FAR-20`.
- `backfill_comment_authors_from_audit`: preenche autores de comentarios de ajuste/resposta usando auditoria historica.

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

## Acesso externo (recomendacao)

### Melhor opcao imediata (demo): tunnel HTTPS

Use Cloudflare Tunnel ou ngrok para expor frontend/backend sem abrir porta no roteador.

### Ajustes obrigatorios para externo

1. Backend CORS por padrao aceita apenas origens locais (`localhost:5173`).
2. Se frontend e backend estiverem em dominios diferentes, configure `VITE_API_BASE_URL`.

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
- CORS do backend esta restrito a origens locais por padrao.

## Documentos complementares

- `ARCHITECTURE.md`
- `AI_INSTRUCTIONS.md`
