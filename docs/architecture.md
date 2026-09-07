# Architecture

HYBRID EMOTIONAL ENGINE is a pnpm and Turborepo modular monorepo. `apps/web` is the initial Next.js application. Shared responsibilities live in `packages`, and future isolated workloads live in `services`.

## Boundaries

- `packages/emotional-core` owns pure domain contracts and future domain behavior.
- `packages/database` will own PostgreSQL and Drizzle persistence.
- `packages/auth` will own Better Auth integration.
- `packages/validation` will own shared Zod contracts.
- `packages/ai` will own future provider adapters and orchestration.
- `packages/config` will own typed server-only configuration.
- `packages/types` will hold platform and transport types that are not domain types.
- `packages/ui` will hold shared shadcn/ui components.
- `services/ml` is reserved for future machine-learning workloads.

The Emotional Core must remain independent from React, Next.js, persistence, queues, billing, HTTP, browser APIs, and UI. This keeps the domain package reusable by another application and makes its behavior straightforward to test. The web application may depend on the core; the core must not depend on the web application.

No microservices are introduced in Phase 1. Future services should be extracted only when operational or scaling boundaries justify the cost.
