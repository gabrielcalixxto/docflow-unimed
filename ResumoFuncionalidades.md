# Resumo Funcionalidades

Resumo direto do que esta implementado hoje no projeto.

## Autenticacao

- Login em `POST /auth/login`.
- Campo de login: `username`.
- JWT inclui `roles`, `company_ids`, `sector_ids` e campos legados.

## Documentos

- Criar documento:
  - gera codigo `TIPO-SET-ID`
  - cria versao `1` em `RASCUNHO`.
- Atualizar documento:
  - nova versao via `POST /documents/{document_id}/versions`.
- Fluxo:
  - `RASCUNHO -> EM_REVISAO` (submit)
  - `EM_REVISAO -> VIGENTE` (aprovar)
  - `EM_REVISAO -> RASCUNHO` (reprovar)
  - vigente anterior vai para `OBSOLETO` quando nova vigente e aprovada.

## Regras por papel (backend)

- `REVISOR`: envia para revisao.
- `COORDENADOR`: aprova/reprova.
- `AUTOR`: cria e atualiza documento, mas nao envia para revisao na regra atual.
- `LEITOR`: consulta.
- `ADMIN`: gestao administrativa.

## Frontend

Telas ativas:

- Busca
- Novo Documento
- Atualizar Documento
- Central de Aprovacao
- Historico de Solicitacoes
- Painel de Documentos
- Painel de RNC (placeholder)
- Painel de Usuarios
- Cadastro de Setores
- Cadastro de Empresas
- Cadastro Tipo de Documento

Menu:

- itens diretos: `Busca`, `Central de Aprovacao`
- grupos colapsaveis:
  - `Solicitacoes`
  - `Painel de Indicadores`
  - `Gestao de Cadastros`

## Cadastros administrativos

Empresas:

- nome normalizado por titulo com excecao `de/do/da`.

Setores:

- nome normalizado por titulo com excecao `de/do/da`.
- filtro por empresa no painel de listagem.

Tipos documentais:

- cadastro com `sigla` + `nome`
- `sigla` obrigatoria, maiuscula e alfanumerica
- `nome` normalizado no padrao de titulo.

## Regra de UX de filtros

Todos os filtros existentes preservam viewport (nao voltam para o topo da pagina):

- filtros de busca
- filtros do painel de documentos
- filtro de setores por empresa

Hook central:

- `frontend/src/hooks/useViewportPreserver.js`

## Limites atuais

- `AuditService` ainda placeholder.
- sem Alembic no fluxo atual.
