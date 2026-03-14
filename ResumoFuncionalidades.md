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
  - nova versao via `POST /documents/{document_id}/versions`
  - numero da versao gerado automaticamente (`ultima + 1`).
- Fluxo:
  - `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO` (revisor aprova)
  - `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO` (revisor desaprova)
  - `PENDENTE_COORDENACAO -> VIGENTE` (coordenador aprova)
  - `PENDENTE_COORDENACAO -> REPROVADO` (coordenador reprova)
  - vigente anterior vai para `OBSOLETO` quando nova vigente e aprovada.
  - `EM_REVISAO` permanece como compatibilidade de dados antigos.

## Regras por papel (backend)

- `REVISOR`: aprova/desaprova rascunho e envia para coordenacao.
- `COORDENADOR`: aprova/reprova etapa final.
- `AUTOR`: cria e atualiza documento, mas nao envia para revisao na regra atual.
- `LEITOR`: consulta.
- `ADMIN`: gestao administrativa e busca.

## Frontend

Telas ativas:

- Busca
- Novo Documento
- Atualizar Documento
- Central de Aprovacao
- Historico de Solicitacoes
- Painel de Documentos
- Painel de RNC (placeholder)
- Cadastro de Usuarios
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
