# DocFlow Unimed

## Visao geral

Este repositorio contem o MVP de uma plataforma de gestao documental para ambientes regulados.

O foco do projeto esta no ciclo de vida do documento, versionamento, aprovacao por alcada, segregacao por setor, trilha de auditoria e busca segura retornando apenas documentos vigentes.

## Objetivo

Construir uma aplicacao full stack com:

- frontend em React com Tailwind CSS
- backend em Python com FastAPI
- banco PostgreSQL
- autenticacao com JWT Bearer Token
- conteinerizacao separada para frontend e backend

## Escopo do MVP

O MVP precisa garantir:

- taxonomia obrigatoria por documento
- versionamento estrutural
- fluxo de aprovacao por setor
- controle de acesso por papel e abrangencia
- auditoria imutavel
- busca protegida por versao vigente

## Regras de negocio principais

### 1. Taxonomia minima obrigatoria

Todo documento deve possuir, no minimo:

- setor
- tipo documental
- data de vencimento

Regra de modelagem adotada:

- setor pertence ao documento logico
- tipo documental pertence ao documento logico
- data de vencimento pertence a versao do documento

### 2. Ciclo de vida

Status obrigatorios:

- `RASCUNHO`
- `EM_REVISAO`
- `VIGENTE`
- `OBSOLETO`

Transicoes permitidas:

- `RASCUNHO -> EM_REVISAO`
- `EM_REVISAO -> RASCUNHO` quando houver rejeicao
- `EM_REVISAO -> VIGENTE` quando houver aprovacao
- `VIGENTE -> OBSOLETO`

Regra importante:

- rejeicao nao cria um status novo; a mesma versao volta para `RASCUNHO` com motivo registrado

### 3. Versionamento

- um documento pode ter varias versoes
- so pode existir uma unica versao `VIGENTE` por documento
- editar um documento `VIGENTE` nunca sobrescreve a versao ativa
- a alteracao de um `VIGENTE` cria uma nova versao em `RASCUNHO`
- quando a nova versao vira `VIGENTE`, a anterior vira `OBSOLETO`

### 4. Governanca, alcada e visibilidade

Abrangencias:

- `CORPORATIVO`: visivel para usuarios autenticados com permissao de leitura
- `LOCAL`: visivel apenas para usuarios do mesmo setor

Papeis minimos:

- `AUTOR`
- `COORDENADOR`
- `LEITOR`
- `ADMIN`

Responsabilidades:

- `AUTOR`: cria rascunhos, edita rascunhos e submete para revisao
- `COORDENADOR`: aprova ou rejeita documentos do proprio setor
- `LEITOR`: busca e visualiza apenas documentos `VIGENTE`
- `ADMIN`: administra dados de sistema e apoio operacional

Campos obrigatorios de governanca:

- `created_by`
- `approved_by`

### 5. Auditoria

O sistema deve manter trilha imutavel para eventos criticos, no minimo:

- `document_created`
- `version_created`
- `submitted_for_review`
- `approved`
- `rejected`
- `set_to_vigente`
- `marked_obsolete`
- `document_viewed`

Cada evento deve registrar:

- documento
- versao
- usuario
- data e hora

### 6. Busca protegida

A busca padrao deve retornar apenas documentos com versao `VIGENTE`.

Nao devem aparecer em buscas padrao:

- `RASCUNHO`
- `EM_REVISAO`
- `OBSOLETO`

Versoes antigas ou nao ativas devem ficar restritas a fluxos administrativos ou de auditoria.

## Arquitetura

Arquitetura de alto nivel:

```text
Frontend (React + Tailwind CSS)
        |
        v
Backend API (FastAPI)
        |
        v
PostgreSQL
```

Separacao de responsabilidades esperada no backend:

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

Regra estrutural central:

- `documents` representa a identidade logica
- `document_versions` representa o historico e o estado de cada revisao

Entidades conceituais minimas:

- `users`
- `roles`
- `user_roles`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

## Estrutura atual do repositorio

```text
backend/
  main.py
frontend/
docker/
ARCHITECTURE.md
AI_INSTRUCTIONS.md
README.md
```

## Estado atual da implementacao

No estado atual deste repositorio:

- a documentacao arquitetural foi alinhada
- `backend/main.py` ainda esta vazio
- `frontend/` ainda nao possui scaffold de aplicacao
- `docker/` ainda nao possui configuracao executavel

Por isso, o projeto ainda nao roda end-to-end neste momento.

## Execucao local

Ainda nao existem artefatos suficientes no repositorio para execucao completa local.

Antes da primeira execucao, ainda sera necessario adicionar:

1. bootstrap da aplicacao FastAPI
2. scaffold do frontend React
3. configuracao de variaveis de ambiente
4. migracoes e inicializacao do PostgreSQL
5. `docker compose` com servicos de frontend, backend e banco

Enquanto isso nao for implementado, este README funciona como referencia de escopo e de arquitetura, nao como guia de runtime final.

## Setup de banco esperado

O banco alvo do projeto e PostgreSQL.

A modelagem deve contemplar pelo menos:

- identidade de usuario e papeis
- relacao de usuarios com setores
- empresas e setores
- identidade logica de documentos
- historico de versoes
- eventos de auditoria

Quando o setup tecnico for adicionado ao repositorio, esta secao deve ser atualizada com:

- estrategia de migrations
- variaveis de ambiente necessarias
- comando de inicializacao local
- carga de seeds iniciais

## Seeds recomendadas

Empresas:

- Operadora
- Hospital
- Crescer Bem

Setores:

- Nutricao
- Enfermagem
- Qualidade
- Administrativo

Papeis:

- Autor
- Coordenador
- Leitor
- Admin

## Endpoints principais esperados

- `POST /auth/login`
- `POST /documents`
- `GET /documents`
- `GET /documents/{id}`
- `POST /documents/{id}/versions`
- `POST /documents/{id}/submit-review`
- `POST /documents/{id}/approve`
- `POST /documents/{id}/reject`
- `GET /documents/search`

## Justificativas arquiteturais

- documento e versao foram separados para preservar historico, auditoria e conformidade
- a regra de apenas uma versao `VIGENTE` evita ambiguidade operacional
- a rejeicao retorna para `RASCUNHO` para manter somente os quatro estados obrigatorios
- a busca padrao protege o usuario final contra uso de conteudo obsoleto ou nao aprovado
- as regras ficam no backend para evitar dependencia de validacoes apenas no frontend

## Documentos de referencia

- `ARCHITECTURE.md`: fonte de verdade da arquitetura e do dominio
- `AI_INSTRUCTIONS.md`: regras para agentes de codigo trabalharem no repositorio
