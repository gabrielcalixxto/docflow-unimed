# DocFlow Unimed

Plataforma web para gestao documental com versionamento, fluxo de aprovacao e controle de acesso por perfil.

## Estado atual do sistema

- Login por `username` + senha com JWT (`POST /auth/login`).
- Busca retorna apenas documentos com versao `VIGENTE`.
- Tela `Novo Documento` possui dois cards no mesmo lugar:
  - `Criar documento`
  - `Atualizar documento` (nova versao).
- Criacao de documento gera automaticamente:
  - codigo no formato `TIPO-SET-ID` (ex.: `POP-ENF-8`)
  - versao `1` em `RASCUNHO`.
- Nova versao gera numero automatico (`ultima + 1`) e inicia em `RASCUNHO`.
- Arquivos enviados vao para banco (`stored_files`) via `/file-storage/upload`.

## Fluxo documental implementado

Status usados:

- `RASCUNHO`
- `REVISAR_RASCUNHO`
- `PENDENTE_COORDENACAO`
- `EM_REVISAO` (compatibilidade legada)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes principais:

- revisor envia para coordenacao: `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO`
- revisor desaprova rascunho: `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO`
- coordenador aprova: `PENDENTE_COORDENACAO/EM_REVISAO -> VIGENTE`
- coordenador reprova: `PENDENTE_COORDENACAO/EM_REVISAO -> REPROVADO`
- quando uma nova versao vira `VIGENTE`, a `VIGENTE` anterior vira `OBSOLETO`.

## Menu lateral atual

Itens diretos:

- `Busca`
- `Central de Aprovacao`

Grupo `Solicitacoes`:

- `Novo Documento`
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

## Regras de acesso (frontend)

Implementadas em `frontend/src/utils/roles.js`:

- `LEITOR`: apenas `Busca`
- `AUTOR`: `Busca`, `Novo Documento`, `Historico de Solicitacoes`, `Nova RNC (Em breve)`
- `REVISOR`: tudo de `AUTOR` + `Central de Aprovacao` + `Painel de Indicadores` + `Gestao de Cadastros`
- `COORDENADOR`: `Busca`, `Novo Documento`, `Historico de Solicitacoes`, `Nova RNC (Em breve)`, `Central de Aprovacao`
- `ADMIN`: `Busca` + `Cadastro de Usuarios` + `Gestao de Cadastros`

Observacao importante:

- O frontend exibe catalogos para `REVISOR`, mas o backend (`/admin/catalog`) exige `ADMIN`.

## UX de filtros

Os filtros do frontend preservam viewport (nao pulam para o topo da pagina) com:

- `frontend/src/hooks/useViewportPreserver.js`

Aplicado nas telas com filtros (busca, solicitacoes, historico, painel de documentos, novo documento e telas administrativas).

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

Files:

- `POST /file-storage/upload`
- `GET /file-storage/{storage_key}`
- `GET /file-storage/{storage_key}?download=1`

Admin users:

- `GET /admin/users`
- `GET /admin/users/options`
- `POST /admin/users`
- `PUT /admin/users/{user_id}`
- `DELETE /admin/users/{user_id}`

Admin catalog:

- `GET /admin/catalog/options`
- `POST /admin/catalog/companies`
- `PUT /admin/catalog/companies/{company_id}`
- `DELETE /admin/catalog/companies/{company_id}`
- `POST /admin/catalog/sectors`
- `PUT /admin/catalog/sectors/{sector_id}`
- `DELETE /admin/catalog/sectors/{sector_id}`
- `POST /admin/catalog/document-types`
- `PUT /admin/catalog/document-types/{document_type_id}`
- `DELETE /admin/catalog/document-types/{document_type_id}`

## Regras de cadastro e normalizacao

Empresas, setores e nome de tipo documental:

- formato titulo por palavra
- `de`, `do`, `da` ficam minusculas quando nao sao a primeira palavra
- palavras explicitamente maiusculas (ex.: `TI`, `CEU`) sao preservadas.

Siglas:

- `document_types.sigla`: obrigatoria, maiuscula, alfanumerica
- `sectors.sigla`: obrigatoria, maiuscula, alfanumerica

## Auditoria e rastreabilidade

- Eventos de fluxo sao persistidos em `document_events` (evento, documento, versao, usuario, data/hora).
- `AuditService` usa `DocumentEventRepository` quando fornecido.
- `document_versions` possui campos de auditoria de invalidacao:
  - `invalidated_by`
  - `invalidated_at`

## Execucao com Docker

1. Copie `.env.example` para `.env`.
2. Suba os servicos:

```bash
docker compose up -d --build postgres backend frontend
```

3. Enderecos:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Healthcheck: `http://localhost:8000/health`

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

- Telas de RNC estao como placeholder (`Em breve`).
- Nao ha migracoes Alembic versionadas no fluxo atual (schema criado/ajustado no startup).
- Auditoria persiste eventos tecnicos; ainda nao existe trilha funcional completa em UI para consulta desses eventos.
