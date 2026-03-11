# BACKEND_PROGRESS.md

## Objetivo

Este arquivo resume o estado atual do backend para acompanhar o que ja foi feito e o que falta, sem depender de memoria de conversa.

## Snapshot atual (2026-03-11)

- Stack backend: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Driver de banco: `psycopg[binary]`.
- Hash de senha: `bcrypt` (sem `passlib`).
- Estrutura em camadas criada: `core`, `models`, `schemas`, `repositories`, `services`, `routers`.
- API sobe, cria tabelas via `create_all`, expoe healthcheck e possui logging HTTP.
- Endpoints principais ja executam regras centrais de escrita (criacao, submissao, aprovacao e versao).
- Base de testes automatizados esta ativa e validada.

## Estrutura implementada

Backend em:

- `backend/main.py`
- `backend/app/core/`
- `backend/app/models/`
- `backend/app/schemas/`
- `backend/app/repositories/`
- `backend/app/services/`
- `backend/app/routers/`

### Inicializacao da API

`backend/main.py`:

- cria `FastAPI` com `lifespan`
- tenta criar tabelas com `Base.metadata.create_all(bind=engine)`
- registra routers de `auth`, `search`, `documents`, `versions`
- expoe `GET /health` retornando `{ "status": "ok" }`

## Endpoints disponiveis hoje

### Auth

- `POST /auth/login`

### Documents

- `POST /documents`
- `GET /documents`
- `GET /documents/{document_id}`
- `POST /documents/{document_id}/submit-review`
- `POST /documents/{document_id}/approve`

### Versions

- `POST /documents/{document_id}/versions`
- `GET /documents/{document_id}/versions`

### Search

- `GET /documents/search`

## O que ja esta funcional

### Seguranca/JWT

- Geracao de token com `sub`, `role`, `user_id`, `exp`.
- Validacao de token em dependencia `get_current_user`.
- Hash e verificacao de senha com `bcrypt`.

### Login

- `AuthService` gera token JWT.
- Login consulta `users` no banco via `AuthRepository`.
- Credencial e validada por email + `bcrypt` (`verify_password`).
- Token inclui `sub`, `role` e `user_id`.
- Credencial invalida retorna `401` com `Invalid email or password.`.
- Role de acesso vem do registro persistido na tabela `users`.

### Persistencia de leitura

- `DocumentRepository` lista e busca documento por id.
- `VersionRepository` lista versoes por documento.
- `SearchRepository` retorna apenas versoes `VIGENTE`.

### Persistencia de escrita e fluxo de status

- `DocumentService.create_document` persiste documento e registra evento de criacao.
- `VersionService.create_version` persiste nova versao com validacoes:
  - documento precisa existir
  - status inicial obrigatorio `RASCUNHO`
  - `version_number` unico por documento
- `DocumentService.submit_for_review` faz transicao `RASCUNHO -> EM_REVISAO`.
- `DocumentService.approve_document` faz transicao `EM_REVISAO -> VIGENTE`.
- Aprovacao obsoleta automaticamente a versao anterior `VIGENTE -> OBSOLETO`.
- Fluxos de escrita usam transacao com `commit`/`rollback`.
- Mapeamento de erros de dominio para HTTP:
  - `403` sem permissao
  - `404` recurso inexistente
  - `409` conflito de estado/regra

### Regras de permissao aplicadas

- `LEITOR` nao pode criar documento nem criar versao.
- Aprovacao exige `COORDENADOR` ou `ADMIN`.
- Quando coordenador tem setor definido, aprovacao exige mesmo setor do documento.

### Modelagem base

Entidades criadas:

- `companies`
- `sectors`
- `users`
- `documents`
- `document_versions`
- `document_events`

Regras/constraints ja refletidas no modelo:

- `document_versions` com unicidade `(document_id, version_number)`.
- indice parcial para garantir uma unica versao `VIGENTE` por documento (PostgreSQL).

### Logging HTTP

Middleware ativo para observabilidade de requests:

- log de `request_start` (method/path/query/request_id)
- log de `request_end` (status/tempo/body JSON com truncamento)
- log de `request_error` com stack trace
- mascaramento de campos sensiveis: `password`, `access_token`, etc.

Configuracoes no `Settings`:

- `LOG_LEVEL`
- `LOG_REQUESTS`
- `LOG_RESPONSE_BODY`
- `LOG_RESPONSE_BODY_MAX_CHARS`

## O que ainda esta scaffold (nao final)

- `AuditService` ainda usa `create_placeholder_event(...)` (sem persistencia em `document_events`).
- Fluxo de rejeicao (`EM_REVISAO -> RASCUNHO` com motivo) ainda nao foi implementado.
- Regras completas de visibilidade por escopo (`CORPORATIVO` vs `LOCAL`) ainda podem ser aprofundadas nas listagens.
- Migracoes versionadas (Alembic) ainda nao substituem `create_all`.

## Base de testes automatizados criada

Arquivos adicionados:

- `backend/pytest.ini`
- `backend/requirements-dev.txt`
- `backend/tests/conftest.py`
- `backend/tests/unit/` (testes unitarios)
- `backend/tests/api/` (testes de rota com TestClient e overrides)

Cobertura atual da suite (48 testes):

- unidade de `auth_service` e `security`
- unidade de `document_service`, `version_service`, `search_service`
- unidade dos repositories (filtros/ordenacao/consulta)
- API de health/auth
- API de documents
- API de versions
- API de search

Objetivo da suite atual:

- travar contratos atuais
- permitir evolucao em TDD sem regressao de comportamento ja existente

Status de execucao validado:

- `48 passed` em `python -m pytest -q backend/tests`
- 1 warning de cache do pytest (`.pytest_cache`), sem impacto funcional

## Como rodar os testes

No diretorio `backend`:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## Runtime local e ambiente

Configuracao de containers esta centralizada em:

- `docker-compose.yml` (sem segredo hardcoded)
- `.env` (local, nao versionado)
- `.env.example` (versionado, valores de exemplo)

Variaveis principais de runtime:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `SEED_DEFAULT_USERS`
- `SEED_DEFAULT_PASSWORD`
- `VITE_API_BASE_URL`

Comando padrao de subida:

```bash
docker compose up --build
```

Checks rapidos:

```bash
curl http://localhost:8000/health
```

```bash
curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"coord@teste.com\",\"password\":\"123\"}"
```

## Fluxo TDD recomendado para proximas features

Para cada regra nova do dominio:

1. Escrever primeiro o teste (falhando).
2. Implementar o minimo para passar.
3. Refatorar mantendo suite verde.

Prioridade de testes de negocio (proximas iteracoes):

1. Transicoes validas e invalidas de status.
2. Rejeicao voltando `EM_REVISAO -> RASCUNHO` com motivo.
3. Apenas uma versao `VIGENTE` por documento.
4. Editar vigente criando nova versao em `RASCUNHO` (sem overwrite in-place).
5. Regra de aprovacao por `COORDENADOR` do mesmo setor.
6. Visibilidade `CORPORATIVO` vs `LOCAL`.
7. Busca padrao retornando somente `VIGENTE`.

## Estado de dados para teste manual

- Conexao backend <-> PostgreSQL esta funcional.
- Endpoints protegidos respondem com token JWT valido.
- Seed padrao de usuarios ativo no startup (`SEED_DEFAULT_USERS=true` por default).
- Usuarios seedados por padrao:
  - `admin@docflow.local` (ADMIN)
  - `coord@teste.com` (COORDENADOR)
  - `autor@teste.com` (AUTOR)
  - `leitor@teste.com` (LEITOR)
- Senha default de seed: `SEED_DEFAULT_PASSWORD` (default atual: `123`).
