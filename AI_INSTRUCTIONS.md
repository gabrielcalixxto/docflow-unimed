# AI_INSTRUCTIONS

Guia de implementacao para agentes que alteram este repositorio.

## 1. Escopo do produto

Sistema de gestao documental com:

- versionamento
- fluxo de aprovacao
- controle de acesso por perfil, setor e empresa
- busca de documentos vigentes
- administracao de catalogos (empresa, setor, tipo documental)

Nao tratar como CRUD generico.

## 2. Stack (estado atual)

- Frontend: React + Vite + CSS
- Backend: FastAPI + SQLAlchemy
- Banco: PostgreSQL
- Auth: JWT Bearer
- Docker Compose: `frontend`, `backend`, `postgres`

## 3. Regras de dominio obrigatorias

### 3.1 Documento

- criacao exige: titulo, empresa, setor, tipo documental, escopo, arquivo/url, vencimento
- codigo automatico: `TIPO-SET-ID`
- criacao ja gera versao `1` em `RASCUNHO`.

### 3.2 Status e transicoes

Status validos:

- `RASCUNHO`
- `REVISAR_RASCUNHO`
- `PENDENTE_COORDENACAO`
- `EM_REVISAO`
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes:

- `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO`
- `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO`
- `PENDENTE_COORDENACAO -> VIGENTE`
- `PENDENTE_COORDENACAO -> REPROVADO`
- `VIGENTE -> OBSOLETO`

Compatibilidade:

- `EM_REVISAO` pode aparecer em dados legados.

### 3.3 Regras por perfil (backend)

- `REVISOR`: pode aprovar/desaprovar rascunho e enviar para coordenacao.
- `COORDENADOR`: pode aprovar/reprovar documentos pendentes de coordenacao.
- coordenador com setor definido aprova apenas documentos do mesmo setor.
- `AUTOR` nao envia para revisao na regra atual do backend.
- edicao/exclusao de rascunho: apenas solicitante da criacao (`RASCUNHO` ou `REVISAR_RASCUNHO`).

### 3.4 Regras de cadastro

Empresas/setores/nomes de tipo documental:

- normalizar para formato titulo
- manter `de`, `do`, `da` minusculos quando nao forem primeira palavra.

Tipo documental:

- `sigla` obrigatoria
- `sigla` sempre maiuscula e alfanumerica.

## 4. UX obrigatoria para filtros

Sempre que um filtro for alterado no frontend, manter a posicao atual da pagina (viewport).

Como implementar:

- usar `frontend/src/hooks/useViewportPreserver.js`
- aplicar em todos os filtros existentes e em novos filtros.

Regra adicional:

- ao recarregar dados em fluxo ligado a filtro, preservar viewport quando aplicavel.

## 5. Organizacao backend

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

Diretrizes:

- regra de negocio deve ficar em `services`
- `routers` so orquestram HTTP/dependencias/erros
- validacao de autorizacao deve ser no backend
- `repositories` nao devem conter regra funcional de negocio.

## 6. Endpoints (familias)

- auth (`/auth`)
- documents (`/documents`)
- versions (`/documents/{id}/versions`)
- search (`/documents/search`)
- admin users (`/admin/users`)
- admin catalog (`/admin/catalog`)

## 7. Padrao para alteracoes

- sempre atualizar testes de unidade/API se regra de negocio mudar
- sempre atualizar `.md` quando mudar regra funcional
- nunca documentar comportamento que nao esteja implementado
- evitar texto de roadmap em documentacao principal

## 8. Limitacoes atuais

- `AuditService` permanece placeholder (sem persistencia de eventos)
- sem Alembic no fluxo atual; schema usa `create_all` + ajustes runtime em startup.
