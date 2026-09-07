import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@emora/database';
import { organizationMembers, projects } from '@emora/database/schema';
import type { OrganizationMember, Project } from '@emora/database/schema';

import { auth } from './auth';
import { hasMinimumRole } from './roles';
import type { OrganizationRole } from './roles';
export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export class AuthorizationError extends Error {
  readonly status = 403;
}

export class AuthenticationError extends Error {
  readonly status = 401;
}

export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

export async function requireAuth(headers: Headers): Promise<AuthSession> {
  const session = await getSession(headers);

  if (!session) {
    throw new AuthenticationError('A valid session is required.');
  }

  return session;
}

const organizationIdSchema = z.string().uuid();
const projectIdSchema = z.string().uuid();

export async function requireOrganizationMember(
  userId: string,
  organizationId: string,
): Promise<OrganizationMember> {
  const validOrganizationId = organizationIdSchema.parse(organizationId);
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, validOrganizationId),
    ),
  });

  if (!membership) {
    throw new AuthorizationError('Organization membership is required.');
  }

  return membership;
}

export async function requireOrganizationRole(
  userId: string,
  organizationId: string,
  minimumRole: OrganizationRole,
): Promise<OrganizationMember> {
  const membership = await requireOrganizationMember(userId, organizationId);
  if (!hasMinimumRole(membership.role, minimumRole)) {
    throw new AuthorizationError('Insufficient organization permissions.');
  }

  return membership;
}

export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minimumRole: OrganizationRole = 'VIEWER',
): Promise<{ project: Project; membership: OrganizationMember }> {
  const validProjectId = projectIdSchema.parse(projectId);
  const result = await db
    .select({ project: projects, membership: organizationMembers })
    .from(projects)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, projects.organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .where(eq(projects.id, validProjectId))
    .limit(1);
  const authorized = result[0];

  if (!authorized) {
    throw new AuthorizationError('Project access is not permitted.');
  }

  if (!hasMinimumRole(authorized.membership.role, minimumRole)) {
    throw new AuthorizationError('Insufficient project permissions.');
  }

  return authorized;
}

export async function requireOrganizationContext(
  headers: Headers,
  organizationId: string,
): Promise<{ session: AuthSession; membership: OrganizationMember }> {
  const session = await requireAuth(headers);
  const membership = await requireOrganizationMember(
    session.user.id,
    organizationId,
  );

  return { session, membership };
}
