# HYBRID EMOTIONAL ENGINE

Foundation monorepo for a hybrid AI engine that will model estimated emotional states using psychological equations, machine learning, contextual reasoning, temporal dynamics, and emotional memory. The product never claims to detect or measure a person's true emotion.

## Architecture

This is a modular pnpm and Turborepo monorepo. The Next.js application lives in `apps/web`; reusable boundaries live in `packages`; future ML workloads live in `services/ml`. `packages/emotional-core` is pure TypeScript and has no dependency on React, Next.js, databases, queues, HTTP, browser APIs, or UI.

## Technology Stack

- TypeScript, strict mode, ESLint, Prettier
- pnpm and Turborepo
- Next.js App Router, React, Tailwind CSS, shadcn/ui foundation, Lucide
- Zod validation foundation
- PostgreSQL and Drizzle foundation
- Vitest, Testing Library, and Playwright foundations
- Docker Compose and GitHub Codespaces devcontainer

## Repository Structure

```text
apps/web             Next.js application
packages/emotional-core  Framework-independent domain contracts
packages/{database,auth,validation,ai,config,types,ui}
services/ml          Future ML boundary
docs                   Architecture and product foundations
tests                  Cross-package test boundary
```

## Local Development

Requirements: Node.js 22+, pnpm 10+, and Docker for local infrastructure.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start the PostgreSQL and Redis development containers when needed:

```bash
docker compose up -d
```

These containers are infrastructure foundations only. Application database access and Redis logic are intentionally deferred.

## Codespaces

Open the repository in GitHub Codespaces. The `.devcontainer` configuration provides Node.js, pnpm setup, Docker tooling, forwarded web/database ports, and the recommended editor extensions. Run `docker compose up -d` for local PostgreSQL and Redis.

## Environment Variables

Copy `.env.example` to a local environment file when future phases need configuration. It contains placeholders only. Server secrets must never be exposed to the browser or committed to Git.

## Roadmap

Phase 1 establishes the monorepo, developer environment, package boundaries, and domain contracts. Future phases may add typed configuration, persistence, authentication, versioned APIs, psychological equations, ML providers, hybrid fusion, and product workflows in that order of responsibility. See `docs/` for the current boundaries and limitations.
