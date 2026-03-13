# AI_INSTRUCTIONS

Guia de implementacao para agentes de codigo neste repositorio.

## 1. Contexto do projeto

Plataforma de gestao documental com:

- versionamento
- fluxo de aprovacao
- segregacao por perfil/setor
- busca protegida

Nao tratar como CRUD generico.

## 2. Stack atual (nao assumir diferente)

- Frontend: React + Vite + CSS
- Backend: FastAPI + SQLAlchemy
- Banco: PostgreSQL
- Auth: JWT Bearer Token
- Orquestracao local: Docker Compose

## 3. Regras de dominio obrigatorias

### 3.1 Taxonomia minima

Criacao/atualizacao devem considerar:

- setor
- tipo documental
- data de vencimento

### 3.2 Status de versao

Somente:

- `RASCUNHO`
- `EM_REVISAO`
- `VIGENTE`
- `OBSOLETO`

### 3.3 Transicoes validas

- `RASCUNHO -> EM_REVISAO`
- `EM_REVISAO -> RASCUNHO`
- `EM_REVISAO -> VIGENTE`
- `VIGENTE -> OBSOLETO`

Nao criar status novo sem alinhamento explicito do dono do produto.

### 3.4 Codigo do documento

Padrao atual:

- `TIPO-SET-ID` (ex.: `POP-ENF-8`)

### 3.5 Edicao/exclusao de rascunho

Permitido somente quando:

- usuario autenticado e o solicitante da criacao (`document.created_by`)
- ultima versao esta em `RASCUNHO`

## 4. Perfis e permissoes

Perfis:

- `AUTOR` (rotulado como `REVISOR` no frontend)
- `COORDENADOR`
- `LEITOR`
- `ADMIN`

Regras essenciais:

- `AUTOR`: cria e envia para revisao
- `COORDENADOR`: aprova/reprova em revisao (restricao por setor quando definida)
- `LEITOR`: leitura/busca
- `ADMIN`: administracao e operacao ampliada

## 5. Arquitetura backend

```text
backend/
  app/
    routers/
    services/
    repositories/
    models/
    schemas/
    core/
  main.py
```

Responsabilidades:

- `routers`: HTTP e mapping de erros
- `services`: regra de negocio
- `repositories`: persistencia
- `models`: ORM
- `schemas`: contratos de API
- `core`: config, db, seed, seguranca, logging

## 6. Endpoints (familias)

- auth (`/auth`)
- documents (`/documents`)
- versions (subrotas de `/documents`)
- search (`/documents/search`)
- admin users (`/admin/users`)
- admin catalog (`/admin/catalog`)

## 7. Boas praticas para agentes

- Validar regra no backend; nao confiar apenas no frontend.
- Evitar logica de negocio em router.
- Cobrir alteracoes com testes de unidade e/ou API.
- Atualizar documentacao quando mudar regra de dominio.

## 8. Limitacoes atuais que devem ser respeitadas

- `AuditService` ainda e placeholder (sem persistencia real de eventos).
- Sem Alembic no fluxo atual (`create_all` no startup).
