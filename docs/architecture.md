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

## Phase 3 authorization flow

Better Auth answers “who is this user?” from the server-side session. Authorization then answers “may this user perform this operation?” by joining `organization_members` to the requested organization or to the project’s `organization_id`. This keeps tenant checks at the data-access boundary rather than in frontend state or middleware alone.

The `/api/auth/[...all]` route is the only web adapter for Better Auth. `/login`, `/register`, and `/forgot-password` are minimal client forms; the protected `/app` page retrieves its session on the server. `AUTH_SECRET`, `DATABASE_URL`, and other server credentials remain outside client bundles.
