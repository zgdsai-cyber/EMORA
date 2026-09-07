# Security

Phase 3 separates authentication from authorization:

- **Authentication** is handled by Better Auth in `packages/auth`. It identifies a user with email/password and stores secure server-side sessions in PostgreSQL. `AUTH_SECRET` is required at startup and is never imported by client code.
- **Authorization** is handled by server utilities in `packages/auth/src/authorization.ts`. Every organization or project operation checks the authenticated user, membership, role, and project ownership. A browser-supplied organization ID is only an input to a membership query, never proof of access.

## Identity and sessions

The existing `users` table is the single application identity. Better Auth uses it through the Drizzle adapter; `accounts`, `sessions`, and `verifications` are authentication tables. Sessions use HTTP-only, secure-in-production cookies with the `emora` prefix and SameSite behavior provided by Better Auth. OAuth accounts can be added through the same `accounts` table later.

## Tenant isolation and RBAC

Organizations are the tenant boundary. Projects join to their organization, and all future project resources must be reached through an authorized project query. Roles are ordered `VIEWER < MEMBER < ADMIN < OWNER`; destructive ownership operations must require `OWNER`, while normal project access starts at `VIEWER`.

The middleware provides an early redirect for missing session cookies, but protected pages and data actions must still call `requireAuth`, `requireOrganizationMember`, `requireOrganizationRole`, or `requireProjectAccess`. Frontend filtering is never authorization.

## Audit and secrets

`recordAuditEvent` writes security events to the existing `audit_logs` table after validating UUIDs and metadata with Zod. Audit metadata must not contain passwords, session secrets, tokens, API keys, or sensitive emotional content. Secrets belong only in environment configuration; they are not logged or sent to client components.
