# AI_INSTRUCTIONS.md

## Purpose

This file defines implementation rules for AI coding agents working in this repository.

The goal is to keep generated code aligned with the architecture, domain constraints, and engineering standards of the project.

Agents must read and follow this file before creating, editing, or refactoring code.

## 1. Project Context

This repository contains the MVP core of a document management platform for regulated environments.

The project is centered on:

- lifecycle control
- structural versioning
- approval workflow
- sector-aware visibility
- role-based access control
- immutable audit trail
- safe search that returns only active content by default

This is not a generic CRUD project.

## 2. Mandatory Stack

- Frontend: React with Tailwind CSS
- Backend: Python with FastAPI
- Database: PostgreSQL
- Authentication: JWT Bearer Token
- Containerization: separate Docker containers for frontend and backend

Do not replace the stack unless explicitly instructed.

## 3. Non-Negotiable Domain Rules

### 3.1 Mandatory taxonomy

Every document must include, at minimum:

- `sector`
- `document_type`
- `expiration_date`

Modeling expectation:

- `sector` belongs to the document identity
- `document_type` belongs to the document identity
- `expiration_date` belongs to the document version

Do not accept creation or update flows that omit required taxonomy fields.

### 3.2 Lifecycle statuses

The only valid statuses are:

- `RASCUNHO`
- `EM_REVISAO`
- `VIGENTE`
- `OBSOLETO`

### 3.3 Allowed transitions

Only these transitions are valid:

- `RASCUNHO -> EM_REVISAO`
- `EM_REVISAO -> RASCUNHO` when a coordinator rejects the draft
- `EM_REVISAO -> VIGENTE` when a coordinator approves the draft
- `VIGENTE -> OBSOLETO`

Do not create extra statuses unless the project owner explicitly changes the domain.

Do not allow invalid transitions in the backend.

Rejection must not create a new workflow status. It returns the same version to `RASCUNHO` and should store a reason.

### 3.4 Versioning rules

These rules are mandatory:

1. A document may have multiple versions.
2. For one logical document in one sector, only one version may be `VIGENTE` at a time.
3. Editing a `VIGENTE` version must not overwrite the active version in place.
4. Editing a `VIGENTE` document must create a new version in `RASCUNHO`.
5. When a new version becomes `VIGENTE`, the previous `VIGENTE` version must automatically become `OBSOLETO`.

Never simplify this behavior into a plain update.

### 3.5 Search rules

Default search behavior must protect the user.

Mandatory behavior:

- search results return only `VIGENTE` versions by default
- `RASCUNHO`, `EM_REVISAO`, and `OBSOLETO` do not appear in standard reader search flows
- old versions are exposed only in explicit administrative or audit flows

Do not expose obsolete or non-approved versions in normal listing endpoints.

### 3.6 Visibility rules

Documents have one of these scopes:

- `CORPORATIVO`
- `LOCAL`

Scope meaning:

- `CORPORATIVO`: visible to authenticated users with reading permission across sectors
- `LOCAL`: visible only to users from the related sector, still respecting role permissions

Visibility must always be enforced in the backend.

### 3.7 Roles and permissions

Minimum roles:

- `AUTOR`
- `COORDENADOR`
- `LEITOR`
- `ADMIN`

Role behavior:

`AUTOR`

- can create drafts
- can edit drafts
- can submit drafts for review
- cannot approve or publish outside the defined workflow

`COORDENADOR`

- can review drafts from the same sector
- can approve drafts from the same sector
- can reject drafts from the same sector
- cannot approve drafts from unrelated sectors unless a future rule explicitly allows it

`LEITOR`

- can search and view permitted `VIGENTE` documents
- cannot edit
- cannot approve
- cannot change workflow state

`ADMIN`

- can manage administrative data
- can manage users, roles, and configuration
- does not bypass domain rules unless the service layer explicitly defines a safe administrative action

Do not hardcode frontend permissions as the source of truth.

### 3.8 Governance fields

The system must explicitly record:

- `created_by`
- `approved_by`

These fields are part of the domain model, not optional metadata.

### 3.9 Audit rules

Audit is part of the domain, not an optional technical detail.

The system must keep an immutable event log for critical actions.

Minimum events:

- `document_created`
- `version_created`
- `submitted_for_review`
- `approved`
- `rejected`
- `set_to_vigente`
- `marked_obsolete`
- `document_viewed`

Each event must be associated with:

- document
- version
- user
- timestamp

Recommended additional fields:

- sector
- action context
- reason or notes

Do not silently bypass audit creation in domain flows.

## 4. Backend Architecture Rules

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

### Layer responsibilities

`routers`

- receive HTTP requests
- validate request shape with schemas
- call services
- translate domain errors into HTTP responses
- do not contain complex business logic

`services`

- implement business rules
- validate transitions
- orchestrate versioning
- apply permissions
- generate audit events

`repositories`

- encapsulate database access
- isolate ORM and query code
- do not implement business rules

`models`

- define ORM entities and constraints

`schemas`

- define request and response contracts

`core`

- authentication
- configuration
- shared dependencies
- shared enums and helpers

## 5. Data Modeling Expectations

Minimum entities:

- `users`
- `roles`
- `user_roles`
- `companies`
- `sectors`
- `document_types`
- `documents`
- `document_versions`
- `document_events`

Recommended fields:

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

Recommended constraints:

- only one active version per document
- unique version number per document
- document code uniqueness according to the chosen business scope

## 6. API Rules

Use REST semantics correctly.

Expected route families:

- authentication
- documents
- versions
- review and approval
- search
- audit

Example routes:

- `POST /auth/login`
- `POST /documents`
- `GET /documents`
- `GET /documents/{id}`
- `POST /documents/{id}/versions`
- `POST /documents/{id}/submit-review`
- `POST /documents/{id}/approve`
- `POST /documents/{id}/reject`
- `GET /documents/search`

Expected status codes:

- `200 OK`
- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`

Use `409 Conflict` for workflow violations, uniqueness conflicts, or state collisions.

## 7. Security Rules

Protected routes require JWT authentication.

Authorization must be validated in the backend using:

- user identity
- role
- sector relationship
- document scope
- document status
- workflow state

Never trust frontend checks as final authorization.

## 8. Development Guidelines

Agents should prioritize:

1. project structure
2. FastAPI bootstrap
3. PostgreSQL integration
4. ORM models
5. Pydantic schemas
6. JWT authentication
7. repositories
8. services
9. routers
10. audit integration
11. seed data
12. tests

High-priority tests:

- valid and invalid transitions
- rejection returning `EM_REVISAO` to `RASCUNHO`
- versioning behavior without in-place overwrite
- only one `VIGENTE` version at a time
- permissions by role and sector
- visibility by scope
- search returning only `VIGENTE`

## 9. Constraints for AI Agents

Agents may:

- scaffold the project
- create models, schemas, repositories, services, and routers
- configure JWT authentication
- prepare Docker setup
- add tests for business rules

Agents must not:

- invent domain rules not defined in the documentation
- place business logic in routers
- place persistence logic in unrelated layers
- treat versioning as a simple update
- trust frontend permissions as final authorization
- fake run instructions or setup details that do not exist in the repository

If the repository is still in a scaffold phase, document missing runtime steps explicitly instead of inventing them.

## 10. Documentation Rules

When changing the architecture or domain behavior, update these files together:

- `ARCHITECTURE.md`
- `AI_INSTRUCTIONS.md`
- `README.md`

The three documents must stay consistent about:

- stack
- lifecycle
- rejection behavior
- taxonomy
- versioning
- permissions
- audit requirements
- setup expectations
