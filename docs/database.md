# Database

Phase 2 provides the PostgreSQL and Drizzle ORM foundation in `packages/database`. It is a database-only package: it has no dependency on React, Next.js UI, the Emotional Core, Redis, Stripe, or authentication.

## Local Setup

The Compose PostgreSQL service uses `pgvector/pgvector:pg16` and exposes port `5432` with the development-only credentials in `docker-compose.yml`.

```bash
docker compose up -d postgres
DATABASE_URL=postgresql://emora:emora_dev_only@localhost:5432/emora pnpm --filter @emora/database db:migrate
```

`DATABASE_URL` is required by both the runtime client and Drizzle Kit. Credentials are placeholders only and must not be reused outside local development.

## Tables

The initial migration creates:

- `users`, `organizations`, and `organization_members` for identity references and tenant membership.
- `projects` and `api_keys` for project isolation and hashed key storage.
- `emotional_profiles`, `emotional_events`, `emotional_states`, `emotional_memories`, `emotion_predictions`, and `emotion_feedback` for future modeled-state data.
- `model_versions` and `model_parameters` for versioned future model configuration.
- `usage_records`, `subscriptions`, `billing_events`, and `audit_logs` for future SaaS operations.

All primary keys are UUIDs. Timestamps use timezone-aware PostgreSQL timestamps. Emotional scalar values use `double precision`; flexible evolving payloads use typed JSONB only where needed (`profile_data`, contexts, metadata, states, predictions, parameters, and billing payloads).

## Relationships and Tenancy

Organizations are the primary tenant boundary. Projects belong to organizations, and access to projects will later be derived from `organization_members`. Profiles, events, states, memories, predictions, feedback, and API keys are project-scoped. Usage, subscriptions, billing events, and audit logs are organization-scoped.

Foreign keys use PostgreSQL's default `NO ACTION` behavior. This avoids accidental deletion of historical, usage, billing, or audit records. Authorization and tenant enforcement are intentionally not implemented yet.

## Indexes

Indexes cover membership lookup, organization/project ownership, profile and time-series queries, prediction feedback, usage metering, and audit-log chronology. Composite unique indexes enforce organization slugs, project slugs within an organization, profile external references within a project, model versions, model parameters, and future billing idempotency keys.

## pgvector

The migration enables the `vector` extension and defines `emotional_memories.embedding` as `vector(1536)`. The dimension is an explicit foundation decision for a future embedding provider; changing providers or dimensions requires a deliberate migration. No vector index, similarity query, or semantic search is implemented in this phase.

## Migrations and Scaling

Drizzle Kit reads `src/schema/index.ts` and writes migrations to `packages/database/drizzle`. The initial migration is reproducible from an empty database, including the pgvector extension. Future work should add migration review, connection pooling limits, retention policies for high-volume events, partitioning only after measured workload evidence, and authorization-aware query boundaries.
