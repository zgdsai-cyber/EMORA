import { afterAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  auditLogs,
  db,
  emotionalProfiles,
  organizationMembers,
  organizations,
  projects,
  users,
} from '@emora/database';

import { ProfileError } from './errors';
import type { AcceptedCreateProfileRequest } from './validation';

/**
 * Slice 3 persistence tests against the real database: exact create contract,
 * atomic profile+audit transaction, duplicate 409 semantics with zero audit
 * rows, audit metadata allow-list, audit-failure rollback, membership-scoped
 * project discovery, deterministic ordering, and cross-project isolation.
 *
 * `@emora/auth` (used by discovery for requireProjectAccess) requires
 * AUTH_SECRET at module load — same convention as the packages/auth tests.
 */
process.env.AUTH_SECRET ??= 'integration-only-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);

const createdOrganizationIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

const VALID_REQUEST: AcceptedCreateProfileRequest = {
  externalReference: 'slice3-profile-1',
  personalityProfile: {
    emotionalSensitivity: 0.5,
    baselineTrust: 0.5,
    baselineAnxiety: 0.5,
    attachmentSensitivity: 0.5,
    nostalgiaSensitivity: 0.5,
    jealousySensitivity: 0.5,
  },
};

interface Scenario {
  readonly organizationId: string;
  readonly userId: string;
  readonly projectId: string;
}

async function createScenario(
  role: 'VIEWER' | 'MEMBER' = 'MEMBER',
): Promise<Scenario> {
  const unique = crypto.randomUUID();
  const [organization] = await db
    .insert(organizations)
    .values({
      name: `Slice 3 Test Org ${unique}`,
      slug: `slice3-org-${unique}`,
    })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ email: `slice3-${unique}@example.test`, name: 'Slice 3 Test' })
    .returning();
  createdOrganizationIds.push(organization.id);
  createdUserIds.push(user.id);

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role,
  });
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: `Slice 3 Test Project ${unique}`,
      slug: `slice3-project-${unique}`,
    })
    .returning();
  createdProjectIds.push(project.id);

  return {
    organizationId: organization.id,
    userId: user.id,
    projectId: project.id,
  };
}

/** Invoke the Slice 3 create service (dynamic import: @emora/auth module init). */
async function create(scenario: Scenario, request = VALID_REQUEST) {
  const { createProjectProfile } = await import('./service');
  return createProjectProfile({
    userId: scenario.userId,
    organizationId: scenario.organizationId,
    projectId: scenario.projectId,
    requestId: crypto.randomUUID(),
    request,
  });
}

async function auditRows(scenario: Scenario) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, scenario.organizationId),
        eq(auditLogs.action, 'emotional_profile.created'),
      ),
    );
}

async function profileRows(scenario: Scenario) {
  return db
    .select({
      id: emotionalProfiles.id,
      externalReference: emotionalProfiles.externalReference,
      profileData: emotionalProfiles.profileData,
    })
    .from(emotionalProfiles)
    .where(eq(emotionalProfiles.projectId, scenario.projectId));
}

function violationOf(action: () => Promise<unknown>) {
  return action().then(
    () => ({}),
    (error: ProfileError) => ({ code: error.code, status: error.status }),
  );
}

afterAll(async () => {
  if (createdProjectIds.length > 0) {
    await db
      .delete(emotionalProfiles)
      .where(inArray(emotionalProfiles.projectId, createdProjectIds));
    await db
      .delete(auditLogs)
      .where(inArray(auditLogs.organizationId, createdOrganizationIds));
    await db.delete(projects).where(inArray(projects.id, createdProjectIds));
  }
  if (createdOrganizationIds.length > 0) {
    await db
      .delete(organizationMembers)
      .where(
        inArray(organizationMembers.organizationId, createdOrganizationIds),
      );
    await db
      .delete(organizations)
      .where(inArray(organizations.id, createdOrganizationIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

integration('Slice 3 profile create persistence', () => {
  it('creates a profile with exactly one allow-listed audit row', async () => {
    const scenario = await createScenario();

    const result = await create(scenario, {
      ...VALID_REQUEST,
      additionalTraits: { name: 0.5, openness: 0 },
    });

    expect(result.status).toBe(201);
    expect(Object.keys(result.body).sort()).toEqual([
      'createdAt',
      'externalReference',
      'profileId',
      'projectId',
      'requestId',
    ]);
    expect(result.body.projectId).toBe(scenario.projectId);
    expect(result.body.externalReference).toBe('slice3-profile-1');
    expect(result.body.profileId).toBe(result.profileId);
    expect(Date.parse(result.body.createdAt)).not.toBeNaN();

    // Exactly one audit row with the frozen metadata allow-list.
    const audits = await auditRows(scenario);
    expect(audits).toHaveLength(1);
    const [auditRow] = audits;
    expect(auditRow.action).toBe('emotional_profile.created');
    expect(auditRow.resourceType).toBe('emotional_profile');
    expect(auditRow.resourceId).toBe(result.profileId);
    expect(Object.keys(auditRow.metadata ?? {}).sort()).toEqual([
      'outcome',
      'profileId',
      'projectId',
      'requestId',
    ]);
    expect((auditRow.metadata as Record<string, unknown>).outcome).toBe(
      'succeeded',
    );

    // Persisted profileData keeps the frozen loader shape.
    const profiles = await profileRows(scenario);
    expect(profiles).toHaveLength(1);
    const stored = profiles[0].profileData as {
      personalityProfile: Record<string, unknown>;
    };
    expect(Object.keys(stored)).toEqual(['personalityProfile']);
    expect(Object.keys(stored.personalityProfile).sort()).toEqual([
      'additionalTraits',
      'attachmentSensitivity',
      'baselineAnxiety',
      'baselineTrust',
      'emotionalSensitivity',
      'jealousySensitivity',
      'nostalgiaSensitivity',
    ]);
    expect(stored.personalityProfile.emotionalSensitivity).toBe(0.5);
    expect(stored.personalityProfile.additionalTraits).toEqual({
      name: 0.5,
      openness: 0,
    });
    expect(JSON.stringify(audits)).not.toContain('personalityProfile');
  });

  it('rejects a duplicate externalReference with 409 and zero audit rows', async () => {
    const scenario = await createScenario();
    await create(scenario);
    const before = await auditRows(scenario);

    expect(
      await violationOf(() =>
        create(scenario, {
          ...VALID_REQUEST,
          personalityProfile: { ...VALID_REQUEST.personalityProfile },
        }),
      ),
    ).toEqual({ code: 'external_reference_conflict', status: 409 });

    // No second profile, no second audit row.
    expect(await profileRows(scenario)).toHaveLength(1);
    expect(await auditRows(scenario)).toEqual(before);
  });

  it('allows the same externalReference in a different project', async () => {
    const scenarioA = await createScenario();
    const scenarioB = await createScenario();
    const first = await create(scenarioA);
    const second = await create(scenarioB);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.externalReference).toBe(second.body.externalReference);
  });

  it('rolls back the profile when the audit insert fails', async () => {
    const scenario = await createScenario();
    // Force the audit insert to fail for this request only (sentinel CHECK).
    await db.execute(
      sql`ALTER TABLE "audit_logs" ADD CONSTRAINT "test_block_profile_create_audit" CHECK (metadata->>'requestId' IS DISTINCT FROM '__forceAuditFailure__')`,
    );
    try {
      const { createProjectProfile } = await import('./service');
      expect(
        await violationOf(() =>
          createProjectProfile({
            userId: scenario.userId,
            organizationId: scenario.organizationId,
            projectId: scenario.projectId,
            requestId: '__forceAuditFailure__',
            request: {
              ...VALID_REQUEST,
              externalReference: 'audit-failure-profile',
            },
          }),
        ),
      ).toEqual({ code: 'internal_error', status: 500 });

      // The profile insert must have been rolled back with the audit failure.
      const profiles = await profileRows(scenario);
      expect(profiles.map((row) => row.externalReference)).not.toContain(
        'audit-failure-profile',
      );
      expect(await auditRows(scenario)).toHaveLength(0);
    } finally {
      await db.execute(
        sql`ALTER TABLE "audit_logs" DROP CONSTRAINT "test_block_profile_create_audit"`,
      );
    }
  });

  it('writes no audit row for failed domain validation', async () => {
    const scenario = await createScenario();
    expect(
      await violationOf(() =>
        create(scenario, {
          ...VALID_REQUEST,
          externalReference: 'invalid-domain-profile',
          personalityProfile: {
            ...VALID_REQUEST.personalityProfile,
            // Out of [0,1]: must fail closed at the domain layer (400).
            emotionalSensitivity: 1.5 as number,
          },
        }),
      ),
    ).toEqual({ code: 'invalid_input', status: 400 });
    expect(await profileRows(scenario)).toHaveLength(0);
    expect(await auditRows(scenario)).toHaveLength(0);
  });
});

integration('Slice 3 discovery persistence', () => {
  it('lists only member projects in createdAt,id order and is empty for strangers', async () => {
    const { listAuthorizedProjects } = await import('./service');
    const scenario = await createScenario();

    const [project2] = await db
      .insert(projects)
      .values({
        organizationId: scenario.organizationId,
        name: 'Slice 3 Second Project',
        slug: `slice3-project-2-${crypto.randomUUID()}`,
      })
      .returning();
    createdProjectIds.push(project2.id);

    const result = await listAuthorizedProjects({
      userId: scenario.userId,
      requestId: crypto.randomUUID(),
    });
    const listed = result.body.projects
      .filter((row) => [scenario.projectId, project2.id].includes(row.projectId))
      .map((row) => row.projectId);
    expect(listed).toEqual([scenario.projectId, project2.id]);

    const [stranger] = await db
      .insert(users)
      .values({
        email: `slice3-stranger-${crypto.randomUUID()}@example.test`,
        name: 'Stranger',
      })
      .returning();
    createdUserIds.push(stranger.id);
    const empty = await listAuthorizedProjects({
      userId: stranger.id,
      requestId: crypto.randomUUID(),
    });
    expect(empty.body.projects).toEqual([]);
  });

  it('isolates profiles per project and orders them deterministically', async () => {
    const { listProjectProfiles } = await import('./service');
    const scenarioA = await createScenario();
    const scenarioB = await createScenario();

    const first = await create(scenarioA, {
      ...VALID_REQUEST,
      externalReference: 'iso-a-1',
    });
    const second = await create(scenarioA, {
      ...VALID_REQUEST,
      externalReference: 'iso-a-2',
    });
    await create(scenarioB, {
      ...VALID_REQUEST,
      externalReference: 'iso-b-1',
    });

    const listedA = await listProjectProfiles({
      projectId: scenarioA.projectId,
      requestId: crypto.randomUUID(),
    });
    expect(listedA.body.profiles.map((row) => row.externalReference)).toEqual([
      'iso-a-1',
      'iso-a-2',
    ]);
    expect(listedA.body.profiles[0].profileId).toBe(first.profileId);
    expect(listedA.body.profiles[1].profileId).toBe(second.profileId);

    const listedB = await listProjectProfiles({
      projectId: scenarioB.projectId,
      requestId: crypto.randomUUID(),
    });
    expect(listedB.body.profiles.map((row) => row.externalReference)).toEqual([
      'iso-b-1',
    ]);

    const scenarioEmpty = await createScenario();
    const empty = await listProjectProfiles({
      projectId: scenarioEmpty.projectId,
      requestId: crypto.randomUUID(),
    });
    expect(empty.body.profiles).toEqual([]);
  });

  it('enforces membership authorization server-side (cross-tenant)', async () => {
    const { requireProjectAccess } = await import('@emora/auth');
    const scenarioA = await createScenario();
    const scenarioB = await createScenario('VIEWER');

    await expect(
      requireProjectAccess(scenarioB.userId, scenarioA.projectId, 'VIEWER'),
    ).rejects.toThrow();
    await expect(
      requireProjectAccess(scenarioB.userId, scenarioB.projectId, 'MEMBER'),
    ).rejects.toThrow();
    await expect(
      requireProjectAccess(scenarioA.userId, scenarioA.projectId, 'MEMBER'),
    ).resolves.toMatchObject({
      project: { id: scenarioA.projectId },
    });
  });
});
