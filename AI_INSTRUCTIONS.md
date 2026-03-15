# AI_INSTRUCTIONS

Guia para agentes que alteram este repositorio.

## 1. Escopo do produto

Sistema de gestao documental com:

- versionamento
- fluxo de aprovacao
- controle de acesso por perfil, setor e empresa
- busca de documentos vigentes
- administracao de cadastros (usuarios, empresas, setores, tipo documental)

Nao tratar como CRUD generico.

## 2. Stack atual

- Frontend: React + Vite + CSS
- Backend: FastAPI + SQLAlchemy
- Banco: PostgreSQL
- Auth: JWT Bearer
- Docker Compose: `frontend`, `backend`, `postgres`

## 3. Regras de dominio obrigatorias

### 3.1 Documento

- criacao exige: titulo, empresa, setor, tipo documental, escopo, `file_path`, vencimento
- codigo automatico: `TIPO-SET-ID`
- criacao gera versao `1` em `RASCUNHO`
- nova versao inicia em `RASCUNHO` e recebe numero automatico
- bloquear nova versao se houver versao em andamento.

### 3.2 Status e transicoes

Status validos:

- `RASCUNHO`
- `REVISAR_RASCUNHO`
- `PENDENTE_COORDENACAO`
- `EM_REVISAO` (compatibilidade legada)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes:

- `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO` (revisor envia)
- `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO` (revisor rejeita rascunho)
- `PENDENTE_COORDENACAO/EM_REVISAO -> VIGENTE` (coordenador aprova)
- `PENDENTE_COORDENACAO/EM_REVISAO -> REPROVADO` (coordenador reprova)
- `VIGENTE -> OBSOLETO` (quando nova versao vira vigente)

### 3.3 Regras por perfil (backend)

- `AUTOR`, `REVISOR`, `COORDENADOR`: podem criar documento e criar nova versao
- submit para coordenacao: apenas `REVISOR`
- aprovacao/reprovacao final: apenas `COORDENADOR`
- coordenador com setor definido aprova apenas documentos do mesmo setor
- edicao/exclusao de rascunho: apenas solicitante da criacao
- gestao de usuarios e catalogo backend: apenas `ADMIN`.

### 3.4 Regras de data

- `DocumentCreate.expiration_date`: `>= hoje` e `<= hoje + 2 anos`
- `DocumentVersionCreate.expiration_date`: `>= hoje`
- `DocumentDraftUpdate.expiration_date`: `>= hoje`

### 3.5 Regras de cadastro

Empresas, setores e nome de tipo documental:

- normalizar para titulo por palavra
- manter `de`, `do`, `da` minusculos quando nao forem primeira palavra
- preservar palavras explicitamente maiusculas (ex.: `TI`, `CEU`).

Siglas:

- `document_types.sigla`: obrigatoria, maiuscula, alfanumerica
- `sectors.sigla`: obrigatoria, maiuscula, alfanumerica

## 4. UX obrigatoria para filtros

Sempre que filtro mudar no frontend, manter viewport.

Como implementar:

- usar `frontend/src/hooks/useViewportPreserver.js`
- aplicar em filtros novos e existentes.

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

- regra funcional em `services`
- `routers` somente HTTP/dependencias/tratamento de erro
- autorizacao sempre no backend
- `repositories` sem regra de negocio.

## 6. Endpoints (familias)

- auth (`/auth`)
- documents (`/documents`)
- versions (`/documents/{id}/versions`)
- search (`/documents/search`)
- files (`/file-storage`)
- admin users (`/admin/users`)
- admin catalog (`/admin/catalog`)

## 7. Menu e paginas atuais

Itens diretos:

- `Busca`
- `Central de Aprovacao`

Grupo `Solicitacoes`:

- `Novo Documento` (inclui card de atualizacao de versao)
- `Historico de Solicitacoes`
- `Nova RNC (Em breve)`

Grupo `Painel de Indicadores`:

- `Painel de Documentos`
- `Painel de RNC (Em breve)`

Grupo `Gestao de Cadastros`:

- `Cadastro de Usuarios`
- `Cadastro de Setores`
- `Cadastro de Empresas`
- `Cadastro Tipo de Documento`

## 8. Padrao de alteracoes

- atualizar testes se regra de negocio mudar
- atualizar `.md` quando comportamento funcional mudar
- nao documentar funcionalidades nao implementadas
- evitar roadmap em arquivos tecnicos principais

## 9. Limitacoes atuais

- RNC ainda placeholder (`Em breve`)
- sem Alembic versionado no fluxo atual (schema ajustado em startup)
- eventos de auditoria sao persistidos em `document_events`, mas sem tela dedicada para consulta.
