import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '@emora/database/schema';

const databaseUrl = process.env.DATABASE_URL;
const client = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;
const database = client ? drizzle(client, { schema }) : null;
const integration = process.env.CI ? describe : describe.skipIf(!database);

integration('server-side tenant isolation', () => {
  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it('rejects a project belonging to another organization', async () => {
    if (!database)
      throw new Error('The integration database is not configured.');
    process.env.AUTH_SECRET ??= 'integration-only-secret';
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    const { AuthorizationError, requireProjectAccess } =
      await import('./authorization');
    const [user] = await database
      .insert(schema.users)
      .values({
        email: `tenant-test-${crypto.randomUUID()}@example.test`,
        name: 'Tenant Test User',
      })
      .returning();
    const [organizationA] = await database
      .insert(schema.organizations)
      .values({
        name: 'Tenant A',
        slug: `tenant-a-${crypto.randomUUID()}`,
      })
      .returning();
    const [organizationB] = await database
      .insert(schema.organizations)
      .values({
        name: 'Tenant B',
        slug: `tenant-b-${crypto.randomUUID()}`,
      })
      .returning();

    try {
      await database.insert(schema.organizationMembers).values({
        organizationId: organizationA.id,
        userId: user.id,
        role: 'OWNER',
      });
      const [projectA] = await database
        .insert(schema.projects)
        .values({
          organizationId: organizationA.id,
          name: 'Tenant A Project',
          slug: 'tenant-a-project',
        })
        .returning();
      const [projectB] = await database
        .insert(schema.projects)
        .values({
          organizationId: organizationB.id,
          name: 'Tenant B Project',
          slug: 'tenant-b-project',
        })
        .returning();

      await expect(
        requireProjectAccess(user.id, projectA.id),
      ).resolves.toMatchObject({
        project: { id: projectA.id, organizationId: organizationA.id },
      });
      await expect(
        requireProjectAccess(user.id, projectB.id),
      ).rejects.toBeInstanceOf(AuthorizationError);
    } finally {
      await database
        .delete(schema.projects)
        .where(eq(schema.projects.organizationId, organizationA.id));
      await database
        .delete(schema.projects)
        .where(eq(schema.projects.organizationId, organizationB.id));
      await database
        .delete(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, organizationA.id));
      await database
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, organizationA.id));
      await database
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, organizationB.id));
      await database.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
});
