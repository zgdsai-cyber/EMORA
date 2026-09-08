import { eq, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
const client = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;
const database = client ? drizzle(client, { schema }) : null;

const databaseIntegration = process.env.CI
  ? describe
  : describe.skipIf(!database);

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

  it('rejects cross-project emotional relationships at the database boundary', async () => {
    if (!database) {
      throw new Error('The integration database is not configured.');
    }

    const [user] = await database
      .insert(schema.users)
      .values({
        email: `database-integrity-${crypto.randomUUID()}@example.test`,
        name: 'Database Integrity Test',
      })
      .returning();
    const [organization] = await database
      .insert(schema.organizations)
      .values({
        name: 'Database Integrity Organization',
        slug: `database-integrity-${crypto.randomUUID()}`,
      })
      .returning();

    const projectIds: string[] = [];
    let modelVersionId: string | undefined;

    try {
      await database.insert(schema.organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
      });
      const [projectA, projectB] = await database
        .insert(schema.projects)
        .values([
          {
            organizationId: organization.id,
            name: 'Project A',
            slug: `a-${crypto.randomUUID()}`,
          },
          {
            organizationId: organization.id,
            name: 'Project B',
            slug: `b-${crypto.randomUUID()}`,
          },
        ])
        .returning();
      projectIds.push(projectA.id, projectB.id);
      const [profileA] = await database
        .insert(schema.emotionalProfiles)
        .values({
          projectId: projectA.id,
          externalReference: 'profile-a',
          profileData: {},
        })
        .returning();
      const [profileB] = await database
        .insert(schema.emotionalProfiles)
        .values({
          projectId: projectB.id,
          externalReference: 'profile-b',
          profileData: {},
        })
        .returning();
      const [modelVersion] = await database
        .insert(schema.modelVersions)
        .values({
          name: `integrity-model-${crypto.randomUUID()}`,
          version: '1.0.0',
          status: 'active',
        })
        .returning();
      modelVersionId = modelVersion.id;
      const [eventA] = await database
        .insert(schema.emotionalEvents)
        .values({
          projectId: projectA.id,
          profileId: profileA.id,
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          source: 'test',
        })
        .returning();
      const [predictionA] = await database
        .insert(schema.emotionPredictions)
        .values({
          projectId: projectA.id,
          profileId: profileA.id,
          eventId: eventA.id,
          modelVersionId: modelVersion.id,
          prediction: {},
        })
        .returning();

      await expect(
        database.insert(schema.emotionalEvents).values({
          projectId: projectB.id,
          profileId: profileA.id,
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          source: 'invalid-event',
        }),
      ).rejects.toThrow();
      await expect(
        database.insert(schema.emotionalStates).values({
          projectId: projectB.id,
          profileId: profileA.id,
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          state: {},
          modelVersionId: modelVersion.id,
        }),
      ).rejects.toThrow();
      await expect(
        database.insert(schema.emotionalMemories).values({
          projectId: projectB.id,
          profileId: profileA.id,
          content: 'invalid-memory',
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ).rejects.toThrow();
      await expect(
        database.insert(schema.emotionPredictions).values({
          projectId: projectB.id,
          profileId: profileB.id,
          eventId: eventA.id,
          modelVersionId: modelVersion.id,
          prediction: {},
        }),
      ).rejects.toThrow();
      await expect(
        database.insert(schema.emotionFeedback).values({
          projectId: projectB.id,
          profileId: profileB.id,
          predictionId: predictionA.id,
          feedbackType: 'MODEL_PREDICTION',
          value: {},
          source: 'invalid-feedback',
        }),
      ).rejects.toThrow();
    } finally {
      if (projectIds.length > 0) {
        await database
          .delete(schema.emotionFeedback)
          .where(inArray(schema.emotionFeedback.projectId, projectIds));
        await database
          .delete(schema.emotionPredictions)
          .where(inArray(schema.emotionPredictions.projectId, projectIds));
        await database
          .delete(schema.emotionalEvents)
          .where(inArray(schema.emotionalEvents.projectId, projectIds));
        await database
          .delete(schema.emotionalStates)
          .where(inArray(schema.emotionalStates.projectId, projectIds));
        await database
          .delete(schema.emotionalMemories)
          .where(inArray(schema.emotionalMemories.projectId, projectIds));
        await database
          .delete(schema.emotionalProfiles)
          .where(inArray(schema.emotionalProfiles.projectId, projectIds));
      }
      if (modelVersionId) {
        await database
          .delete(schema.modelVersions)
          .where(eq(schema.modelVersions.id, modelVersionId));
      }
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
