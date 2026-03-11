# ARCHITECTURE.md

## Purpose

This document is the architectural source of truth for the Document Management Platform MVP.

It defines the stack, domain boundaries, data modeling strategy, API direction, and non-negotiable business rules for implementation.

The system is not a generic CRUD application. The backend must preserve:

- lifecycle control
- document versioning
- approval workflow
- sector-based visibility
- role-based access control
- immutable audit trail
- protected search that returns only active content by default

## 1. Product Objective

Build the MVP core of a document management platform for regulated environments.

The platform must support:

- document taxonomy
- document lifecycle management
- version history
- approval delegation by sector
- controlled visibility
- auditability for compliance-relevant actions

## 2. Mandatory Stack

- Frontend: React with Tailwind CSS
- Backend: Python with FastAPI
- Database: PostgreSQL
- Authentication: JWT Bearer Token
- Containerization: separate Docker containers for frontend and backend

React is the selected frontend implementation for this repository. If the project later migrates to Next.js, this document must be updated explicitly.

## 3. High-Level Architecture

```text
Frontend (React + Tailwind CSS)
        |
        v
Backend API (FastAPI)
        |
        v
PostgreSQL
```

### Frontend responsibilities

- authenticate users
- list and search visible active documents
- allow authors to create and edit drafts
- allow coordinators to review and decide pending drafts
- display document metadata, version metadata, and audit data where authorized

### Backend responsibilities

- enforce lifecycle rules
- enforce approval rules
- orchestrate version creation
- enforce scope and sector visibility
- enforce RBAC
- issue and validate JWT tokens
- generate immutable audit events
- coordinate persistence in transactional flows

### Database responsibilities

- preserve relational integrity
- store document identity separately from document history
- support transactional approval and obsolescence updates
- store immutable event history

## 4. Backend Architectural Style

Expected structure:

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

### Layer rules

`routers`

- own HTTP concerns only
- validate request and response schemas
- delegate to services
- translate domain errors into HTTP responses

`services`

- own business rules
- validate lifecycle transitions
- orchestrate versioning
- apply scope, sector, and role checks
- create audit events
- coordinate repository calls inside transactions

`repositories`

- own persistence logic
- isolate ORM and query details
- do not decide workflow behavior
- do not implement business policy

`models`

- define ORM entities and relational constraints

`schemas`

- define Pydantic request and response contracts

`core`

- configuration
- JWT helpers
- authentication dependencies
- shared enums and domain utilities

## 5. Core Domain Concepts

### Document

Represents the logical identity of a controlled document.

It should contain stable business identity data such as:

- code
- title
- company
- sector
- document type
- visibility scope

### Document Version

Represents one historical revision of a document.

It should contain stateful data such as:

- version number
- workflow status
- file reference
- expiration date
- review and approval metadata

Document and document version must remain structurally separated.

## 6. Mandatory Taxonomy

Every document must have, at minimum:

- `sector`
- `document_type`
- `expiration_date`

Modeling rule:

- `sector` belongs to the logical document identity
- `document_type` belongs to the logical document identity
- `expiration_date` belongs to the document version, because it may change between revisions

The backend must reject document creation or draft creation that omits any required taxonomy field.

## 7. Lifecycle Model

### Mandatory statuses

- `RASCUNHO`
- `EM_REVISAO`
- `VIGENTE`
- `OBSOLETO`

### Allowed transitions

- `RASCUNHO -> EM_REVISAO`
- `EM_REVISAO -> RASCUNHO` when the coordinator rejects the draft
- `EM_REVISAO -> VIGENTE` when the coordinator approves the draft
- `VIGENTE -> OBSOLETO`

### Lifecycle rules

- invalid transitions must be blocked in the backend
- frontend state must never be treated as the source of truth
- rejection must not create a new status outside the four mandatory states
- rejection should require a reason and return the same version to `RASCUNHO`

## 8. Versioning Strategy

Versioning is mandatory and must not be simplified.

### Core rules

1. A document may have multiple versions.
2. For one logical document in one sector, only one version may be `VIGENTE` at a time.
3. Editing a `VIGENTE` version must never overwrite the active file or active row in place.
4. Editing a `VIGENTE` document must create a new version in `RASCUNHO`.
5. When a new version becomes `VIGENTE`, the previous `VIGENTE` version must become `OBSOLETO` in the same business flow.

### Architectural implication

The service layer must treat publication as a transaction that:

- validates the approving user
- promotes the target version to `VIGENTE`
- obsoletes the previous active version
- records the corresponding audit events

## 9. Governance, Scope, and Permissions

### Visibility scopes

- `CORPORATIVO`
- `LOCAL`

### Scope meaning

`CORPORATIVO`

- visible to authenticated users with reading permission across sectors

`LOCAL`

- visible only to users from the same sector, still respecting role permissions

Visibility must always be enforced in the backend.

### Required recorded actors

- `created_by`
- `approved_by`

### Minimum roles

- `AUTOR`
- `COORDENADOR`
- `LEITOR`
- `ADMIN`

### Role behavior

`AUTOR`

- creates drafts
- edits drafts
- submits drafts for review
- cannot approve

`COORDENADOR`

- reviews drafts from the same sector
- approves drafts from the same sector
- rejects drafts from the same sector
- cannot approve drafts from unrelated sectors unless an explicit future rule says so

`LEITOR`

- searches and views only permitted `VIGENTE` documents
- cannot edit or change workflow state

`ADMIN`

- manages administrative data
- may inspect broader system information when authorized
- must still respect explicit business rules for publication flows unless the service layer defines a safe override

## 10. Audit Architecture

Audit is part of the domain.

The system must keep an immutable event trail for compliance-relevant actions.

### Minimum events

- `document_created`
- `version_created`
- `submitted_for_review`
- `approved`
- `rejected`
- `set_to_vigente`
- `marked_obsolete`
- `document_viewed`

### Required event payload

Each event must be tied to:

- document
- version
- user
- timestamp

Recommended additional data:

- sector
- action context
- reason or notes

Critical actions must not bypass audit creation.

## 11. Search Protection Strategy

Default search behavior must protect the user.

### Standard search and reader listing rules

- return only documents whose visible version is `VIGENTE`
- exclude `RASCUNHO`
- exclude `EM_REVISAO`
- exclude `OBSOLETO`

Older or non-active versions may only be returned in explicit administrative, compliance, or audit flows.

## 12. Data Modeling Strategy

The relational model must separate identity, history, permissions, and audit.

### Minimum conceptual entities

- `users`
- `roles`
- `user_roles`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

### Conceptual relationships

- `companies -> sectors`
- `documents -> companies`
- `documents -> sectors`
- `documents -> document_types`
- `documents -> document_versions`
- `document_versions -> document_events`
- `users -> roles`
- `users -> sectors` directly or through an association table

### Suggested entity responsibilities

`documents`

- `id`
- `code`
- `title`
- `company_id`
- `sector_id`
- `document_type_id`
- `scope`
- `created_by`
- `created_at`

`document_versions`

- `id`
- `document_id`
- `version_number`
- `status`
- `file_path`
- `expiration_date`
- `review_reason`
- `created_by`
- `approved_by`
- `created_at`
- `approved_at`

`document_events`

- `id`
- `document_id`
- `version_id`
- `user_id`
- `event_type`
- `event_reason`
- `created_at`

### Recommended constraints

- unique active version per document
- version number unique per document
- document code unique inside its business scope, such as company plus sector, if the business confirms that rule

## 13. API Architectural Guidelines

The backend exposes a REST API.

### Expected endpoint families

- authentication
- documents
- versions
- review and approval
- search
- audit

### Example routes

- `POST /auth/login`
- `POST /documents`
- `GET /documents`
- `GET /documents/{id}`
- `POST /documents/{id}/versions`
- `POST /documents/{id}/submit-review`
- `POST /documents/{id}/approve`
- `POST /documents/{id}/reject`
- `GET /documents/search`

### Status code conventions

- `200 OK`
- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`

Use `409 Conflict` for:

- invalid workflow transitions
- unique active version violations
- state collisions during approval or publication

## 14. Security Architecture

Security is enforced primarily in the backend.

Authorization decisions must consider:

- authenticated user
- role
- sector relationship
- document scope
- document status
- workflow state

Security principles:

- never trust frontend filtering as final authorization
- never expose restricted documents through client-only filtering
- do not weaken workflow restrictions for convenience

## 15. Container Architecture

Planned services:

- `frontend`
- `backend`
- `postgres`

Recommended local orchestration:

- `docker compose`

## 16. Development and Testing Priorities

Recommended implementation order:

1. project folder structure
2. FastAPI bootstrap
3. PostgreSQL connection
4. ORM models
5. Pydantic schemas
6. JWT authentication
7. repositories
8. services
9. routers
10. audit integration
11. seed data
12. automated tests

High-priority tests:

- valid and invalid transitions
- rejection returning `EM_REVISAO` to `RASCUNHO`
- versioning without in-place overwrite
- only one `VIGENTE` version at a time
- approval allowed only for coordinators from the same sector
- visibility rules for `CORPORATIVO` and `LOCAL`
- search returning only `VIGENTE`

## 17. Non-Goals for the Initial MVP

The initial MVP does not need:

- advanced notifications
- digital signatures
- external integrations
- complex workflow builders
- analytics dashboards beyond basic operational needs

Correct domain behavior is more important than feature breadth.
