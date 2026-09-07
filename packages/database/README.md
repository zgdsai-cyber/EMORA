# Database

PostgreSQL and Drizzle ORM foundation for the SaaS data layer. This package is independent from React, Next.js UI, the Emotional Core, Redis, and billing providers.

## Commands

```bash
DATABASE_URL=postgresql://emora:emora_dev_only@localhost:5432/emora pnpm db:migrate
pnpm db:generate
pnpm typecheck
pnpm test
```

The package stores API key hashes, never raw API keys. The embedding column is prepared as `vector(1536)` for a future pgvector search phase; no similarity search is implemented here.
