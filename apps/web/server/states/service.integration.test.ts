import { afterAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';

import {
  auditLogs,
  db,
  emotionalEvents,
  emotionalProfiles,
  emotionalStates,
  modelVersions,
  organizationMembers,
  organizations,
  projects,
  users,
} from '@emora/database';

import {
  PARAMETER_IDENTITY,
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../transitions/disclosure';
import { StateReadError } from './errors';

/**
 * Slice 2 read-path persistence tests against the real database: exact read
 * contract, deterministic latest-state ordering, the successful-read audit row
 * with its metadata allow-list, and zero audit rows on every failure path.
 * States are seeded through Slice 1's real transition service so the data is
 * produced by the production write path. Controlled test fixtures only.
 *
 * `@emora/auth` (used by the read service for `recordAuditEvent`) requires
 * AUTH_SECRET at module load — same convention as the packages/auth tests.
 */
process.env.AUTH_SECRET ??= 'integration-only-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);

const STRONG_EVENT = {
  valence: 0.9,
  intensity: 1,
  relevance: 1,
  surprise: 0.5,
  uncertainty: 0.2,
} as const;

const createdOrganizationIds: string[] = [];
const createdUserIds: string[] = [];

interface Scenario {
  readonly organizationId: string;
  readonly userId: string;
  readonly projectId: string;
  readonly profileId: string;
}

async function createScenario(): Promise<Scenario> {
  const unique = crypto.randomUUID();
  const [organization] = await db
    .insert(organizations)
    .values({
      name: `Slice 2 Test Org ${unique}`,
      slug: `slice2-org-${unique}`,
    })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ email: `slice2-${unique}@example.test`, name: 'Slice 2 Test' })
    .returning();
  createdOrganizationIds.push(organization.id);
  createdUserIds.push(user.id);

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: 'VIEWER',
  });
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: `Slice 2 Test Project ${unique}`,
      slug: `slice2-project-${unique}`,
    })
    .returning();
  const profileData = (
    await import('../transitions/fixture')
  ).CONTROLLED_PROFILE_DATA;
  const [profile] = await db
    .insert(emotionalProfiles)
    .values({
      projectId: project.id,
      externalReference: `slice2-profile-${unique}`,
      profileData: profileData as unknown as Record<string, unknown>,
    })
    .returning();

  return {
    organizationId: organization.id,
    userId: user.id,
    projectId: project.id,
    profileId: profile.id,
  };
}

/** Seed real persisted states through Slice 1's production write path. */
async function seedTransition(scenario: Scenario, at: Date = new Date()) {
  const { runProjectScopedTransition } = await import(
    '../transitions/service'
  );
  return runProjectScopedTransition({
    userId: scenario.userId,
    organizationId: scenario.organizationId,
    projectId: scenario.projectId,
    profileId: scenario.profileId,
    idempotencyKey: crypto.randomUUID(),
    request: { ...STRONG_EVENT },
    requestId: crypto.randomUUID(),
    now: at,
  });
}

/** Invoke the Slice 2 read service (dynamic import: @emora/auth module init). */
async function read(
  scenario: Scenario,
  overrides: { organizationId?: string } = {},
) {
  const { readLatestState } = await import('./service');
  return readLatestState({
    userId: scenario.userId,
    organizationId: overrides.organizationId ?? scenario.organizationId,
    projectId: scenario.projectId,
    profileId: scenario.profileId,
    requestId: crypto.randomUUID(),
  });
}

function violationOf(action: () => Promise<unknown>) {
  return action().then(
    () => ({}),
    (error: unknown) =>
      error instanceof StateReadError
        ? {
            code: error.code,
            status: error.status,
            category: error.errorCategory,
          }
        : { code: 'thrown', message: String(error) },
  );
}

async function readAudits(scenario: Scenario) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      userId: auditLogs.userId,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, scenario.organizationId),
        eq(auditLogs.action, 'emotional_state.read'),
      ),
    );
}

afterAll(async () => {
  if (!databaseUrl) return;
  for (const organizationId of createdOrganizationIds) {
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));
    const projectIds = projectRows.map((row) => row.id);
    if (projectIds.length > 0) {
      await db
        .delete(emotionalStates)
        .where(inArray(emotionalStates.projectId, projectIds));
      await db
        .delete(emotionalEvents)
        .where(inArray(emotionalEvents.projectId, projectIds));
      await db
        .delete(emotionalProfiles)
        .where(inArray(emotionalProfiles.projectId, projectIds));
    }
    await db
      .delete(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId));
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
    await db
      .delete(projects)
      .where(eq(projects.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

integration('Slice 2 latest-state read persistence', () => {
  it('returns the exact read contract for the latest state with exactly one audited row', async () => {
    const scenario = await createScenario();
    const seeded = await seedTransition(scenario);

    const result = await read(scenario);
    expect(result.status).toBe(200);
    expect(result.body.stateId).toBe(seeded.body.stateId);
    expect(result.body.projectId).toBe(scenario.projectId);
    expect(result.body.profileId).toBe(scenario.profileId);
    expect(result.body.timestamp).toBe(seeded.body.timestamp);
    expect(result.body.initialized).toBe(true);
    expect(result.body.parameterIdentity).toBe(PARAMETER_IDENTITY);
    expect(result.body.disclosure).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(result.body.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);

    // Exact frozen field set.
    expect(Object.keys(result.body).sort()).toEqual(
      [
        'disclosure',
        'disclosureText',
        'dimensions',
        'emotionVector',
        'initialized',
        'modelIdentity',
        'parameterIdentity',
        'profileId',
        'projectId',
        'requestId',
        'stateId',
        'timestamp',
      ].sort(),
    );
    expect(Object.keys(result.body.dimensions).sort()).toEqual([
      'arousal',
      'intensity',
      'valence',
    ]);
    expect(Object.keys(result.body.emotionVector)).toEqual([
      'love',
      'fear',
      'nostalgia',
      'jealousy',
      'trust',
      'anger',
      'joy',
    ]);

    // Model identity reconstructed from the seeded row + provider constants.
    const [seed] = await db
      .select()
      .from(modelVersions)
      .where(
        and(
          eq(modelVersions.name, 'emora-deterministic-dynamics'),
          eq(modelVersions.version, '1.0.0'),
        ),
      );
    expect(result.body.modelIdentity).toEqual({
      modelVersionId: seed.id,
      name: 'emora-deterministic-dynamics',
      version: '1.0.0',
      providerIdentifier: 'deterministic-emotional-dynamics',
      providerVersion: '1.0.0',
    });

    // Confidence and prohibited fields are absent at every nesting level.
    expect(result.body).not.toHaveProperty('confidence');
    expect(result.body).not.toHaveProperty('confidenceAdjustment');
    const { disclosureText: _text, ...withoutDisclosure } =
      result.body as unknown as Record<string, unknown>;
    const serialized = JSON.stringify(withoutDisclosure);
    expect(_text).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
    for (const forbidden of [
      'confidence',
      'explanationMetadata',
      'dominant',
      'ranking',
      'winner',
      'threshold',
      'score',
      'superiority',
      'context',
      'memories',
      'embedding',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    // Exactly one successful-read audit row with allow-listed metadata.
    const audits = await readAudits(scenario);
    expect(audits).toHaveLength(1);
    const [auditRow] = audits;
    expect(auditRow.action).toBe('emotional_state.read');
    expect(auditRow.resourceType).toBe('emotional_state');
    expect(auditRow.resourceId).toBe(result.body.stateId);
    expect(auditRow.userId).toBe(scenario.userId);
    expect(Object.keys(auditRow.metadata as object).sort()).toEqual(
      ['outcome', 'projectId', 'profileId', 'requestId', 'stateId'].sort(),
    );
    const metadata = JSON.stringify(auditRow.metadata);
    for (const forbidden of [
      'emotionVector',
      'love',
      'fear',
      'nostalgia',
      'jealousy',
      'trust',
      'anger',
      'joy',
      'valence',
      'arousal',
      'intensity',
      'confidence',
      'confidenceAdjustment',
      'context',
      'memories',
      'embedding',
      'requestHash',
      'payload',
      'token',
      'secret',
    ]) {
      expect(metadata).not.toContain(forbidden);
    }
  });

  it('returns the latest state after a second transition (deterministic order)', async () => {
    const scenario = await createScenario();
    const base = new Date();
    const first = await seedTransition(scenario, base);
    // Distinct event timestamps (within the five-minute future tolerance) so
    // the deterministic total order is exercised without an insert-time tie.
    const second = await seedTransition(
      scenario,
      new Date(base.getTime() + 1_000),
    );

    const result = await read(scenario);
    expect(result.body.stateId).toBe(second.body.stateId);
    expect(result.body.stateId).not.toBe(first.body.stateId);

    // The read audit row was created for the latest state only.
    const audits = await readAudits(scenario);
    expect(audits).toHaveLength(1);
    expect(audits[0].resourceId).toBe(second.body.stateId);
  });

  it('returns state_not_found with zero audit rows when no state exists', async () => {
    const scenario = await createScenario();

    expect(await violationOf(() => read(scenario))).toEqual({
      code: 'state_not_found',
      status: 404,
      category: 'state_not_found',
    });
    expect(await readAudits(scenario)).toHaveLength(0);
  });

  it('does not expose a profile that belongs to another project', async () => {
    const scenarioA = await createScenario();
    const scenarioB = await createScenario();
    await seedTransition(scenarioB);

    // scenarioA's project + scenarioB's profile: the pair matches no state and
    // is indistinguishable from "no state yet" (no existence oracle).
    const crossProject = await readLatestStateDirect(scenarioA, scenarioB);
    expect(crossProject).toEqual({
      code: 'state_not_found',
      status: 404,
      category: 'state_not_found',
    });
    expect(await readAudits(scenarioA)).toHaveLength(0);
    expect(await readAudits(scenarioB)).toHaveLength(0); // no reads performed
  });

  it('fails closed with state_data_invalid on corrupted persisted JSONB and no audit row', async () => {
    const scenario = await createScenario();
    const seeded = await seedTransition(scenario);
    await db
      .update(emotionalStates)
      .set({ state: { corrupted: true } as unknown as Record<string, unknown> })
      .where(eq(emotionalStates.id, seeded.body.stateId));

    expect(await violationOf(() => read(scenario))).toEqual({
      code: 'state_data_invalid',
      status: 500,
      category: 'state_integrity',
    });
    expect(await readAudits(scenario)).toHaveLength(0);
  });

  it('fails closed when the successful-read audit row cannot be written', async () => {
    const scenario = await createScenario();
    await seedTransition(scenario);
    const before = await readAudits(scenario);

    // A nonexistent organization id passes Zod but violates the audit FK —
    // the audit insert fails after the read, so the whole read fails closed.
    expect(
      await violationOf(() =>
        read(scenario, { organizationId: crypto.randomUUID() }),
      ),
    ).toEqual({
      code: 'internal_error',
      status: 500,
      category: 'read_audit_failed',
    });

    const after = await readAudits(scenario);
    expect(after).toHaveLength(before.length);
    expect(after.filter((row) => row.action === 'emotional_state.read')).toHaveLength(0);
  });
});

/** Direct cross-project read: scenarioA's ids with scenarioB's profile. */
async function readLatestStateDirect(scenarioA: Scenario, scenarioB: Scenario) {
  const { readLatestState } = await import('./service');
  return violationOf(() =>
    readLatestState({
      userId: scenarioA.userId,
      organizationId: scenarioA.organizationId,
      projectId: scenarioA.projectId,
      profileId: scenarioB.profileId,
      requestId: crypto.randomUUID(),
    }),
  );
}
