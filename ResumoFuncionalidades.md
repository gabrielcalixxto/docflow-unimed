# Resumo Funcionalidades

Resumo direto do que esta implementado hoje.

## Autenticacao

- Login em `POST /auth/login`
- Campo de acesso: `username` (formato esperado: `nome.sobrenome`).
- JWT inclui `roles`, `company_ids`, `sector_ids` e campos legados.

## Documentos

- Criar documento:
  - codigo automatico `TIPO-SET-ID`
  - versao `1` em `RASCUNHO`.
- Atualizar documento:
  - nova versao em `POST /documents/{document_id}/versions`
  - numero de versao automatico (`ultima + 1`).
- Fluxo:
  - `RASCUNHO/REVISAR_RASCUNHO -> PENDENTE_COORDENACAO` (revisor envia)
  - `RASCUNHO/REVISAR_RASCUNHO -> REVISAR_RASCUNHO` (revisor desaprova)
  - `PENDENTE_COORDENACAO/EM_REVISAO -> VIGENTE` (coordenador aprova)
  - `PENDENTE_COORDENACAO/EM_REVISAO -> REPROVADO` (coordenador reprova)
  - versao `VIGENTE` anterior vira `OBSOLETO` quando entra nova vigente.

## Regras por papel (backend)

- `REVISOR`: submete rascunho para coordenacao e pode rejeitar rascunho.
- `COORDENADOR`: aprova/reprova etapa final.
- `AUTOR`: cria documento e cria nova versao.
- `LEITOR`: consulta.
- `ADMIN`: gestao de usuarios e catalogos.

Regras complementares:

- Edicao/exclusao de rascunho: apenas solicitante da criacao.
- Coordenador com setores definidos aprova somente documentos desses setores.

## Frontend

Telas ativas:

- Busca
- Novo Documento (com card de atualizar versao na mesma tela)
- Central de Aprovacao
- Historico de Solicitacoes
- Nova RNC (Em breve)
- Painel de Documentos
- Painel de RNC (Em breve)
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

## Arquivos e pre-visualizacao

- Upload: `POST /file-storage/upload`.
- Arquivos ficam persistidos em `stored_files`.
- Download inline/attachment:
  - `GET /file-storage/{storage_key}`
  - `GET /file-storage/{storage_key}?download=1`.
- Busca exibe preview em drawer com botoes de download e impressao.

## Cadastros administrativos

Empresas:

- nome normalizado em formato titulo
- excecao `de/do/da`
- mantem palavras explicitamente maiusculas (ex.: `TI`, `CEU`).

Setores:

- mesmo padrao de normalizacao
- possui `sigla` obrigatoria
- atualizacao de setor pode sincronizar empresa de documentos e recodificar documentos.

Tipos documentais:

- campos `sigla` + `nome`
- `sigla` obrigatoria, maiuscula e alfanumerica
- atualizacao sincroniza `document_type` dos documentos e recodifica codigos.

## UX de filtros

Filtros preservam viewport via `useViewportPreserver` nas telas com filtros (busca, solicitacoes, historico, painel de documentos, novo documento e telas administrativas).

## Pontos de atencao

- `RNC` ainda placeholder (`Em breve`).
- Sem Alembic no fluxo atual.
- Eventos de auditoria ja sao persistidos em `document_events`, mas sem painel dedicado de auditoria na UI.
