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
  INITIALIZATION_MARKER,
  PARAMETER_IDENTITY,
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from './disclosure';
import { TransitionError } from './errors';
import { CONTROLLED_PROFILE_DATA } from './fixture';
import { runProjectScopedTransition } from './service';

/**
 * Slice 1 end-to-end persistence tests. These exercise the real deterministic
 * core, the real database, and the real transaction/locking path. Controlled
 * test fixtures only — no production provisioning.
 */

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

async function createScenario(
  profileData: unknown = CONTROLLED_PROFILE_DATA,
): Promise<Scenario> {
  const unique = crypto.randomUUID();
  const [organization] = await db
    .insert(organizations)
    .values({
      name: `Slice 1 Test Org ${unique}`,
      slug: `slice1-org-${unique}`,
    })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ email: `slice1-${unique}@example.test`, name: 'Slice 1 Test' })
    .returning();
  createdOrganizationIds.push(organization.id);
  createdUserIds.push(user.id);

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: 'MEMBER',
  });
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: `Slice 1 Test Project ${unique}`,
      slug: `slice1-project-${unique}`,
    })
    .returning();
  const [profile] = await db
    .insert(emotionalProfiles)
    .values({
      projectId: project.id,
      externalReference: `slice1-profile-${unique}`,
      profileData: profileData as Record<string, unknown>,
    })
    .returning();

  return {
    organizationId: organization.id,
    userId: user.id,
    projectId: project.id,
    profileId: profile.id,
  };
}

function call(
  scenario: Scenario,
  options: {
    payload?: unknown;
    key?: string;
    organizationId?: string;
    now?: Date;
    profileId?: string;
    timestamp?: string;
  } = {},
) {
  return runProjectScopedTransition({
    userId: scenario.userId,
    organizationId: options.organizationId ?? scenario.organizationId,
    projectId: scenario.projectId,
    profileId: options.profileId ?? scenario.profileId,
    idempotencyKey: options.key ?? crypto.randomUUID(),
    request: {
      ...STRONG_EVENT,
      ...((options.payload ?? {}) as Record<string, number>),
      ...(options.timestamp ? { timestamp: options.timestamp } : {}),
    },
    requestId: crypto.randomUUID(),
    now: options.now ?? new Date(),
  });
}

function violationOf(action: () => Promise<unknown>) {
  return action().then(
    () => ({}),
    (error: unknown) =>
      error instanceof TransitionError
        ? {
            code: error.code,
            status: error.status,
            category: error.errorCategory,
          }
        : { code: 'thrown', message: String(error) },
  );
}

async function counts(scenario: Scenario) {
  const events = await db
    .select({ id: emotionalEvents.id })
    .from(emotionalEvents)
    .where(eq(emotionalEvents.projectId, scenario.projectId));
  const states = await db
    .select({ id: emotionalStates.id })
    .from(emotionalStates)
    .where(eq(emotionalStates.projectId, scenario.projectId));
  const audits = await db
    .select({ id: auditLogs.id, action: auditLogs.action })
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, scenario.organizationId));
  return {
    events: events.length,
    states: states.length,
    audits: audits.length,
    auditActions: audits.map((row) => row.action).sort(),
  };
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
integration('Slice 1 deterministic transition persistence', () => {
  it('persists event, state, transition audit, and initialization audit atomically', async () => {
    const scenario = await createScenario();
    const result = await call(scenario, { payload: STRONG_EVENT });

    expect(result.status).toBe(201);
    expect(result.body.duplicate).toBe(false);
    expect(result.body.initialized).toBe(true);
    expect(result.body.projectId).toBe(scenario.projectId);
    expect(result.body.profileId).toBe(scenario.profileId);
    expect(result.body.disclosure).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(result.body.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
    expect(result.body.parameterIdentity).toBe(PARAMETER_IDENTITY);

    // All seven domain emotions, canonical order, deterministic values.
    expect(Object.keys(result.body.emotionVector)).toEqual([
      'love',
      'fear',
      'nostalgia',
      'jealousy',
      'trust',
      'anger',
      'joy',
    ]);
    for (const value of Object.values(result.body.emotionVector)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(result.body.dimensions)).toEqual([
      'valence',
      'arousal',
      'intensity',
    ]);

    // Model identity comes from the seeded row, never from the client.
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

    // The response exposes exactly the frozen field set — no internal, no
    // prohibited, and no raw-context field.
    expect(Object.keys(result.body).sort()).toEqual(
      [
        'requestId',
        'duplicate',
        'projectId',
        'profileId',
        'eventId',
        'stateId',
        'timestamp',
        'emotionVector',
        'dimensions',
        'modelIdentity',
        'parameterIdentity',
        'initialized',
        'disclosure',
        'disclosureText',
      ].sort(),
    );
    // Confidence is never exposed by the API, at any nesting level.
    expect(Object.keys(result.body.dimensions).sort()).toEqual([
      'arousal',
      'intensity',
      'valence',
    ]);
    expect(result.body).not.toHaveProperty('confidence');
    expect(result.body).not.toHaveProperty('confidenceAdjustment');
    const { disclosureText: _disclosure, ...withoutDisclosure } = result.body;
    const serialized = JSON.stringify(withoutDisclosure);
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
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(_disclosure).toBe(SCIENTIFIC_DISCLOSURE_TEXT);

    // Persisted rows.
    const [eventRow] = await db
      .select()
      .from(emotionalEvents)
      .where(eq(emotionalEvents.id, result.body.eventId));
    expect(eventRow.projectId).toBe(scenario.projectId);
    expect(eventRow.profileId).toBe(scenario.profileId);
    expect(eventRow.source).toBe('api_transition');
    expect(eventRow.idempotencyKey).not.toBeNull();
    expect(eventRow.requestHash).toMatch(/^[0-9a-f]{64}$/);

    const [stateRow] = await db
      .select()
      .from(emotionalStates)
      .where(eq(emotionalStates.id, result.body.stateId));
    expect(stateRow.eventId).toBe(result.body.eventId);
    expect(stateRow.modelVersionId).toBe(seed.id);
    expect(stateRow.profileId).toBe(scenario.profileId);
    expect(stateRow.timestamp.toISOString()).toBe(result.body.timestamp);
    expect(
      Object.keys(stateRow.state as Record<string, unknown>).sort(),
    ).toEqual(['dimensions', 'emotionVector', 'metadata']);
    expect(
      (stateRow.state as { metadata?: { initialization?: string } }).metadata
        ?.initialization,
    ).toBe(INITIALIZATION_MARKER);

    expect(await counts(scenario)).toEqual({
      events: 1,
      states: 1,
      audits: 2,
      auditActions: [
        'emotional_profile_initialized',
        'emotional_transition.created',
      ],
    });

    const [transitionAudit] = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, 'emotional_transition.created'),
          eq(auditLogs.organizationId, scenario.organizationId),
        ),
      );
    expect(transitionAudit.resourceType).toBe('emotional_transition');
    expect(transitionAudit.resourceId).toBe(result.body.stateId);
    expect(transitionAudit.userId).toBe(scenario.userId);
    const auditSerialized = JSON.stringify(transitionAudit.metadata);
    for (const forbidden of [
      'emotionVector',
      'joy',
      'confidence',
      'valence',
      'intensity',
      'context',
      'requestHash',
    ]) {
      expect(auditSerialized).not.toContain(forbidden);
    }
  });
  it('replays the same key and payload without applying a second transition', async () => {
    const scenario = await createScenario();
    const key = crypto.randomUUID();
    const first = await call(scenario, { key, payload: STRONG_EVENT });
    const replay = await call(scenario, { key, payload: STRONG_EVENT });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);
    expect(replay.body.stateId).toBe(first.body.stateId);
    expect(replay.body.eventId).toBe(first.body.eventId);
    expect(replay.body.timestamp).toBe(first.body.timestamp);
    // The replay response exposes no confidence either.
    expect(Object.keys(replay.body.dimensions).sort()).toEqual([
      'arousal',
      'intensity',
      'valence',
    ]);
    expect(replay.body).not.toHaveProperty('confidence');
    expect(replay.body).not.toHaveProperty('confidenceAdjustment');
    expect(JSON.stringify(replay.body)).not.toContain('confidence');
    expect(await counts(scenario)).toEqual({
      events: 1,
      states: 1,
      audits: 2,
      auditActions: [
        'emotional_profile_initialized',
        'emotional_transition.created',
      ],
    });
  });

  it('rejects the same key with a different payload without writing', async () => {
    const scenario = await createScenario();
    const key = crypto.randomUUID();
    await call(scenario, { key, payload: STRONG_EVENT });
    const before = await counts(scenario);

    expect(
      await violationOf(() =>
        call(scenario, { key, payload: { valence: -0.5, intensity: 0.2 } }),
      ),
    ).toEqual({
      code: 'idempotency_conflict',
      status: 409,
      category: 'idempotency_conflict',
    });
    expect(await counts(scenario)).toEqual(before);
  });

  it('chains a later transition from the persisted state without re-initializing', async () => {
    const scenario = await createScenario();
    const first = await call(scenario, { payload: STRONG_EVENT });
    const second = await call(scenario, {
      payload: { valence: -0.9, intensity: 1, relevance: 1 },
    });

    expect(second.status).toBe(201);
    expect(second.body.stateId).not.toBe(first.body.stateId);
    expect(second.body.initialized).toBe(true);
    // A chained transition starts from a non-zero predecessor, so its result must
    // differ from the zero-initialized first result.
    expect(second.body.emotionVector).not.toEqual(first.body.emotionVector);
    expect(await counts(scenario)).toEqual({
      events: 2,
      states: 2,
      audits: 3,
      auditActions: [
        'emotional_profile_initialized',
        'emotional_transition.created',
        'emotional_transition.created',
      ],
    });
  });

  it('enforces the temporal rules and the future-clock tolerance', async () => {
    const scenario = await createScenario();
    const now = new Date();
    const first = await call(scenario, { payload: STRONG_EVENT, now });

    // A timestamp equal to the latest persisted state is allowed.
    const equal = await call(scenario, {
      payload: STRONG_EVENT,
      now,
      timestamp: first.body.timestamp,
    });
    expect(equal.status).toBe(201);

    // Earlier than the latest persisted state is a deterministic conflict.
    const before = await counts(scenario);
    expect(
      await violationOf(() =>
        call(scenario, {
          now: new Date(now.getTime() + 60_000),
          timestamp: new Date(
            Date.parse(first.body.timestamp) - 3_600_000,
          ).toISOString(),
        }),
      ),
    ).toEqual({
      code: 'temporal_conflict',
      status: 409,
      category: 'temporal_conflict',
    });
    expect(await counts(scenario)).toEqual(before);

    // Beyond the five-minute future tolerance is invalid input.
    expect(
      await violationOf(() =>
        call(scenario, {
          now,
          timestamp: new Date(now.getTime() + 6 * 60_000).toISOString(),
        }),
      ),
    ).toEqual({
      code: 'invalid_input',
      status: 400,
      category: 'invalid_input',
    });
    expect(await counts(scenario)).toEqual(before);

    // Exactly five minutes ahead is still accepted.
    const boundary = await call(scenario, {
      now: new Date(now.getTime() + 30_000),
      timestamp: new Date(now.getTime() + 5 * 60_000).toISOString(),
    });
    expect(boundary.status).toBe(201);
  });
  it('fails closed on invalid persisted profile data with zero writes', async () => {
    const broken = await createScenario({ personalityProfile: {} });
    const missingTrait = await createScenario({
      personalityProfile: {
        emotionalSensitivity: 0.5,
        baselineTrust: 0.5,
        baselineAnxiety: 0.5,
        attachmentSensitivity: 0.5,
        nostalgiaSensitivity: 0.5,
      },
    });
    const outOfRange = await createScenario({
      personalityProfile: {
        ...CONTROLLED_PROFILE_DATA.personalityProfile,
        jealousySensitivity: 4,
      },
    });

    for (const scenario of [broken, missingTrait, outOfRange]) {
      expect(await violationOf(() => call(scenario))).toEqual({
        code: 'profile_data_invalid',
        status: 500,
        category: 'profile_data_integrity',
      });
      expect(await counts(scenario)).toEqual({
        events: 0,
        states: 0,
        audits: 0,
        auditActions: [],
      });
    }
  });

  it('rolls the whole transition back when the audit insert fails', async () => {
    const scenario = await createScenario();

    expect(
      await violationOf(() =>
        call(scenario, { organizationId: crypto.randomUUID() }),
      ),
    ).toEqual({
      code: 'internal_error',
      status: 500,
      category: 'internal_error',
    });

    expect(await counts(scenario)).toEqual({
      events: 0,
      states: 0,
      audits: 0,
      auditActions: [],
    });
  });

  it('does not expose a profile that belongs to another project', async () => {
    const scenarioA = await createScenario();
    const scenarioB = await createScenario();

    expect(
      await violationOf(() =>
        call(scenarioA, { profileId: scenarioB.profileId }),
      ),
    ).toEqual({
      code: 'profile_not_found',
      status: 404,
      category: 'profile_not_found',
    });
    expect(await counts(scenarioB)).toEqual({
      events: 0,
      states: 0,
      audits: 0,
      auditActions: [],
    });
  });

  it('serializes concurrent transitions for one profile without lost updates', async () => {
    const scenario = await createScenario();
    const [left, right] = await Promise.all([
      call(scenario, { payload: STRONG_EVENT }),
      call(scenario, { payload: STRONG_EVENT }),
    ]);

    expect([left.status, right.status]).toEqual([201, 201]);
    // Exactly one call started from the zero initialization; the other must have
    // started from the first result, proving serialization (no lost update).
    expect(left.body.emotionVector).not.toEqual(right.body.emotionVector);
    const persisted = await counts(scenario);
    expect(persisted.events).toBe(2);
    expect(persisted.states).toBe(2);
    expect(persisted.audits).toBe(3);
  });

  it('never double-applies a concurrent duplicate key', async () => {
    const scenario = await createScenario();
    const key = crypto.randomUUID();
    const results = await Promise.all([
      call(scenario, { key, payload: STRONG_EVENT }),
      call(scenario, { key, payload: STRONG_EVENT }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
    expect(results.map((result) => result.body.duplicate).sort()).toEqual([
      false,
      true,
    ]);
    const persisted = await counts(scenario);
    expect(persisted.events).toBe(1);
    expect(persisted.states).toBe(1);
    expect(persisted.audits).toBe(2);
  });
});
