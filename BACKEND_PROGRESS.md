# BACKEND_PROGRESS.md

## Objetivo

Este arquivo resume o estado atual do backend para acompanhar o que ja foi feito e o que falta, sem depender de memoria de conversa.

## Estado atual (resumo rapido)

- Stack backend: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Estrutura em camadas criada: `core`, `models`, `schemas`, `repositories`, `services`, `routers`.
- API sobe com endpoint de saude.
- Endpoints principais existem, mas parte da regra de negocio ainda esta em modo scaffold.
- Base de testes automatizados foi criada para sustentar TDD.

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
- registra routers de `auth`, `documents`, `versions`, `search`
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
- Hash e verificacao de senha com `passlib`.

### Login

- `AuthService` gera token JWT.
- Papel e inferido pelo prefixo do email:
  - `admin*` -> `ADMIN`
  - `coord*` -> `COORDENADOR`
  - `autor*` -> `AUTOR`
  - demais -> `LEITOR`

### Persistencia de leitura

- `DocumentRepository` lista e busca documento por id.
- `VersionRepository` lista versoes por documento.
- `SearchRepository` retorna apenas versoes `VIGENTE`.

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

## O que ainda esta scaffold (nao final)

Os metodos abaixo ainda retornam mensagem de scaffold e **nao** aplicam todas as regras de negocio descritas na arquitetura:

- `DocumentService.create_document`
- `DocumentService.submit_for_review`
- `DocumentService.approve_document`
- `VersionService.create_version`

Hoje eles:

- chamam `AuditService.create_placeholder_event(...)`
- retornam `MessageResponse` informando que a implementacao completa vira depois

Ainda faltam (exemplos):

- validacao completa de transicoes de status
- aprovacao por papel/setor
- orquestracao de promocao para `VIGENTE` + obsolescencia da versao anterior
- persistencia real dos fluxos de criacao/aprovacao/rejeicao

## Base de testes automatizados criada

Arquivos adicionados:

- `backend/pytest.ini`
- `backend/requirements-dev.txt`
- `backend/tests/conftest.py`
- `backend/tests/unit/` (testes unitarios)
- `backend/tests/api/` (testes de rota com TestClient e overrides)

Cobertura atual da suite (31 testes):

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

## Como rodar os testes

No diretorio `backend`:

```bash
py -m pip install -r requirements-dev.txt
py -m pytest -q
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

## Status de git no momento deste resumo

Arquivos de testes e configuracao de testes estao adicionados localmente e ainda nao commitados:

- `backend/pytest.ini`
- `backend/requirements-dev.txt`
- `backend/tests/`
