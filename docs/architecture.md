# Architecture

HYBRID EMOTIONAL ENGINE is a pnpm and Turborepo modular monorepo. `apps/web` is the initial Next.js application. Shared responsibilities live in `packages`, and future isolated workloads live in `services`.

## Boundaries

- `packages/emotional-core` owns pure domain contracts and future domain behavior.
- `packages/database` owns PostgreSQL and Drizzle persistence. Its domain tables include organizations, memberships, projects, emotional resources, usage, billing records, and audit logs. Its authentication tables are `users`, `accounts`, `sessions`, and `verifications`.
- `packages/auth` owns Better Auth, server-side session retrieval, organization context, RBAC, project access checks, and audit event recording. It never imports `emotional-core`.
- `packages/validation` will own shared Zod contracts.
- `packages/ai` will own future provider adapters and orchestration.
- `packages/config` will own typed server-only configuration.
- `packages/types` will hold platform and transport types that are not domain types.
- `packages/ui` will hold shared shadcn/ui components.
- `services/ml` is reserved for future machine-learning workloads.

The Emotional Core must remain independent from React, Next.js, persistence, queues, billing, HTTP, browser APIs, and UI. This keeps the domain package reusable by another application and makes its behavior straightforward to test. The web application may depend on the core; the core must not depend on the web application.

No microservices are introduced in Phase 1. Future services should be extracted only when operational or scaling boundaries justify the cost.

## Database integrity hardening

Profile-scoped emotional resources preserve project ownership at the database
boundary. Composite foreign keys require each `(project_id, profile_id)` pair
to match the owning profile. Predictions additionally require their event to
belong to the same project, feedback must reference a prediction with the same
project and profile, and usage records must match both their project and
organization. Authorization remains an application concern; these constraints
provide structural integrity even when a query forgets a tenant predicate.

Migration `0002_kind_crystal.sql` performs non-destructive preflight checks
before adding these constraints. If an existing database contains an invalid
historical relationship, the migration fails with a relationship-specific
error and requires explicit manual remediation. It never deletes or rewrites
historical records automatically. Existing databases must run the preflight
and resolve reported inconsistencies before applying the migration.

## CI integration policy

CI starts PostgreSQL with the pgvector extension, applies the committed Drizzle
migrations, and runs database and authentication integration tests with CI-only
configuration. Those tests may be skipped locally when PostgreSQL is absent,
but they are mandatory when `CI=true`. The build uses the same non-production
environment configuration so route discovery does not depend on undeclared
developer secrets.

## Phase 3 authorization flow

Better Auth answers “who is this user?” from the server-side session. Authorization then answers “may this user perform this operation?” by joining `organization_members` to the requested organization or to the project’s `organization_id`. This keeps tenant checks at the data-access boundary rather than in frontend state or middleware alone.

The `/api/auth/[...all]` route is the only web adapter for Better Auth. `/login`, `/register`, and `/forgot-password` are minimal client forms; the protected `/app` page retrieves its session on the server. `AUTH_SECRET`, `DATABASE_URL`, and other server credentials remain outside client bundles.
