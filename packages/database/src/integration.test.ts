import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
const client = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;
const database = client ? drizzle(client, { schema }) : null;

const databaseIntegration = describe.skipIf(!database);

databaseIntegration('PostgreSQL database foundation', () => {
  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it('connects, inserts related records, and queries the relation', async () => {
    if (!database) {
      throw new Error('The integration database is not configured.');
    }

    const [user] = await database
      .insert(schema.users)
      .values({
        email: `database-test-${crypto.randomUUID()}@example.test`,
        name: 'Database Integration Test',
      })
      .returning();
    const [organization] = await database
      .insert(schema.organizations)
      .values({
        name: 'Database Integration Test Organization',
        slug: `database-test-${crypto.randomUUID()}`,
      })
      .returning();

    try {
      await database.insert(schema.organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
      });
      const [project] = await database
        .insert(schema.projects)
        .values({
          organizationId: organization.id,
          name: 'Database Integration Test Project',
          slug: 'integration-test',
        })
        .returning();

      const result = await database.query.projects.findFirst({
        where: eq(schema.projects.id, project.id),
        with: { organization: true },
      });

      expect(result?.organization.id).toBe(organization.id);
      expect(result?.organization.slug).toBe(organization.slug);
    } finally {
      await database
        .delete(schema.projects)
        .where(eq(schema.projects.organizationId, organization.id));
      await database
        .delete(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, organization.id));
      await database
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, organization.id));
      await database.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
});
