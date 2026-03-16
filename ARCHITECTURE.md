# ARCHITECTURE

Fonte principal de arquitetura e estado tecnico do backend/frontend.

Status de validacao em 16/03/2026:

- Backend: `149 passed` em `pytest`.
- Frontend: build de producao (`vite build`) concluido com sucesso.

## 1. Topologia

```text
Frontend (React + Vite)
        |
        v
Backend API (FastAPI)
        |
        v
PostgreSQL
```

Containers Docker:

- `frontend`
- `backend`
- `postgres`

## 2. Backend por camadas

```text
backend/
  app/
    core/
    models/
    schemas/
    repositories/
    services/
    routers/
  main.py
```

Responsabilidades:

- `routers`: contrato HTTP, dependencias e mapeamento de erro.
- `services`: regras de negocio e autorizacao funcional.
- `repositories`: consultas e persistencia SQLAlchemy.
- `models`: entidades ORM.
- `schemas`: contratos Pydantic.
- `core`: config, seguranca, db, logging e contexto de auditoria.

## 3. Snapshot tecnico atual

- Stack backend: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Login por `username` (nao por email).
- Sessao pode ser atualizada via `POST /auth/refresh`.
- Usuario com multi-acesso:
  - `roles` (lista)
  - `company_ids` (lista)
  - `sector_ids` (lista)
  - campos legados `role/company_id/sector_id` mantidos.
- Usuario com controle de conta:
  - `is_active` (inativacao logica)
  - `must_change_password` (troca obrigatoria no primeiro acesso).
- Catalogos com sigla:
  - `document_types.sigla` obrigatoria
  - `sectors.sigla` obrigatoria.
- Upload de arquivos persistido em banco (`stored_files`) via `/file-storage/upload`.
- Auditoria:
  - eventos de fluxo em `document_events`
  - trilha geral em `audit_logs` + `audit_log_changes`.
- Visibilidade documental:
  - `LOCAL`: apenas usuarios com setor liberado.
  - `CORPORATIVO`: visivel para todos os usuarios autenticados.

## 4. Entidades e armazenamento

Entidades principais:

- `users`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`
- `stored_files`
- `audit_logs`
- `audit_log_changes`

Pontos estruturais:

- `documents.document_type` armazenado como string.
- `users` suporta multi-acesso (`roles`, `company_ids`, `sector_ids`).
- `users` suporta flags de conta (`is_active`, `must_change_password`).
- `document_versions`:
  - unique `(document_id, version_number)`
  - indice parcial para unica versao `VIGENTE` por documento (PostgreSQL).
- `document_versions` tambem possui `invalidated_by` e `invalidated_at`.
- `stored_files` guarda binario no banco com vinculo opcional a documento/versao.

## 5. Fluxo de versao e aprovacao

Status:

- `RASCUNHO`
- `RASCUNHO_REVISADO`
- `REVISAR_RASCUNHO`
- `PENDENTE_COORDENACAO` (legado)
- `EM_REVISAO` (compatibilidade legada)
- `REPROVADO`
- `VIGENTE`
- `OBSOLETO`

Transicoes:

- `AUTOR` cria documento/versao em `RASCUNHO`.
- `COORDENADOR` envia para revisao e move para `REVISAR_RASCUNHO`.
- `COORDENADOR` aprova e move para `VIGENTE`.
- `COORDENADOR` reprova para ajuste e move para `REVISAR_RASCUNHO`.
- `COORDENADOR` reprova definitiva e move para `REPROVADO`.
- Ao editar um `REVISAR_RASCUNHO`, o sistema move para `RASCUNHO_REVISADO`.
- `VIGENTE -> OBSOLETO` quando nova versao vigente e aprovada.

## 6. Regras de dominio

- Codigo do documento: `TIPO-SET-ID`.
- Criacao gera versao `1` em `RASCUNHO`.
- Nova versao sempre inicia em `RASCUNHO` com numero automatico.
- Bloqueio de nova versao se ja houver versao em andamento (`RASCUNHO`, `RASCUNHO_REVISADO`, `REVISAR_RASCUNHO`, `PENDENTE_COORDENACAO`, `EM_REVISAO`).
- Criacao/edicao de rascunho e criacao de versao: `AUTOR` (admin por heranca de papel).
- Aprovacao/reprovacao no fluxo atual: `COORDENADOR` (admin por heranca de papel).
- Coordenador com setores definidos aprova/reprova somente no proprio escopo.
- Edicao/exclusao de rascunho: apenas solicitante da criacao.

Regras de data:

- Criacao de documento: vencimento `>= hoje` e `<= hoje + 2 anos`.
- Criacao de versao: vencimento `>= hoje`.
- Edicao de rascunho: vencimento `>= hoje`.

## 7. Seguranca

- JWT inclui:
  - `sub`, `email`, `user_id`
  - `role`, `roles`
  - `company_id`, `company_ids`
  - `sector_id`, `sector_ids`
  - `must_change_password`
  - `exp`.
- Autorizacao principal no service layer.
- Blindagem de primeiro login (`must_change_password`):
  - bloqueio server-side para rotas protegidas;
  - excecao apenas para `POST /auth/change-password` e `POST /auth/refresh`;
  - mesma regra aplicada tambem nos acessos por token em arquivo e websocket.

## 8. Schema e inicializacao

No startup, `main.py` aplica `create_all` e ajustes de compatibilidade em runtime:

- enums de status e role
- colunas de multi-acesso em `users`
- `document_types.sigla`
- `sectors.sigla` e sincronizacao de codigos
- colunas de invalidacao em `document_versions`
- estrutura de auditoria (`audit_logs`/`audit_log_changes`)
- migracao de arquivos legados para `stored_files` quando aplicavel.

## 9. Frontend

Stack:

- React 18
- Vite 5
- CSS em `frontend/src/styles/tailwind.css` e `frontend/src/styles/specific.css`
- tabelas com paginacao + seletor de linhas por pagina
- avatar no topo abre modal com dados do usuario e troca de senha.

Navegacao:

- itens diretos: `Busca`, `Central de Aprovacao`, `Historico de Acoes`
- grupos:
  - `Solicitacoes` (`Novo Documento`, `Historico de Solicitacoes`, `Nova RNC (Em breve)`)
  - `Painel de Indicadores` (`Painel de Documentos`, `Painel de RNC (Em breve)`)
  - `Gestao de Cadastros`.

## 10. Endpoints ativos

Auth:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/change-password`

Documents:

- `POST /documents`
- `GET /documents`
- `GET /documents/form-options`
- `GET /documents/workflow`
- `GET /documents/{document_id}`
- `GET /documents/{document_id}/events`
- `PATCH /documents/{document_id}/draft`
- `DELETE /documents/{document_id}/draft`
- `POST /documents/{document_id}/submit-review`
- `POST /documents/{document_id}/approve`
- `POST /documents/{document_id}/reject`
- `POST /documents/{document_id}/reject-definitive`

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
- `PATCH /admin/users/{user_id}/inactivate`
- `PATCH /admin/users/{user_id}/reactivate`

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

Audit:

- `GET /audit/events`

Realtime:

- `GET ws://<host>/ws/events`

## 11. Observacoes de acesso

- `REVISOR` permanece no enum por compatibilidade historica, mas esta inativo para autorizacao.
- Catalogo (`/admin/catalog`) exige `ADMIN`.
- Gestao de usuarios exige `ADMIN`.
- Historico de acoes:
  - `ADMIN` ve todos os setores.
  - `COORDENADOR` ve apenas eventos ligados a documentos do proprio setor.

## 12. Limites conhecidos

- RNC ainda em placeholder (`Em breve`).
- Sem migracoes Alembic versionadas no fluxo atual (schema inicializado/ajustado no startup).
- CORS no backend configurado por padrao para origens locais.

## 13. Publicacao externa

Melhor estrategia para liberar acesso externo agora sem travar arquitetura definitiva:

1. Curto prazo (demo para gestor/avaliador):
   - usar tunnel HTTPS (Cloudflare Tunnel ou ngrok) para frontend e backend;
   - configurar `VITE_API_BASE_URL` se frontend/backend estiverem em dominios diferentes;
   - liberar CORS para a origem publica do frontend.
2. Medio prazo (definitivo):
   - publicar em VPS/Cloud com Docker Compose;
   - adicionar reverse proxy (Caddy/Nginx) com TLS e dominio;
   - separar segredos por ambiente e habilitar backup/monitoracao.

## 14. Scripts operacionais

- `backend/scripts/validate_and_fill_demo_data.py`
  - valida campos essenciais de logins e arquivos
  - completa faltantes com dados ficticios para demonstracao.
- `backend/scripts/replace_all_pdfs_with_reference.py`
  - substitui o conteudo de todos os PDFs pelo PDF de referencia `MAN-FAR-20`.
- `backend/scripts/backfill_comment_authors_from_audit.py`
  - preenche autores de comentarios de ajuste/resposta a partir da auditoria historica.
