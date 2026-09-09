import { and, eq, inArray, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '@emora/database/schema';
import { createDefaultModelParameters } from '@emora/emotional-core';
import type { LearnableParameterSet } from '@emora/emotional-core';

const databaseUrl = process.env.DATABASE_URL;
const client = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;
const database = client ? drizzle(client, { schema }) : null;
const integration = process.env.CI ? describe : describe.skipIf(!database);

function parameterSet(version: string): LearnableParameterSet {
  const defaults = createDefaultModelParameters();
  return {
    version,
    learnable: {
      eventImpactWeights: { ...defaults.dynamics.eventImpactWeights },
      personalityWeights: { ...defaults.dynamics.personalityWeights },
      emotionWeights: { ...defaults.dynamics.emotionWeights },
      memoryWeights: { ...defaults.dynamics.memoryWeights },
      memoryDecayRate: 1,
      stabilityWeights: {
        rate: defaults.dynamics.stabilityWeights.rate,
        baseline: { ...defaults.dynamics.stabilityWeights.baseline },
      },
      confidenceWeights: { ...defaults.dynamics.confidenceWeights },
    },
    fixed: {
      policyVersion: 'deterministic-interaction-policy-v1',
      interactionWeights: Object.fromEntries(
        Object.entries(defaults.dynamics.interactionWeights).map(([source, targets]) => [
          source,
          { ...targets },
        ]),
      ),
    },
  } as unknown as LearnableParameterSet;
}

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

async function createFixture(roleAssignments: Record<string, Role>) {
  if (!database) throw new Error('The integration database is not configured.');
  const db = database;
  const [organization] = await db.insert(schema.organizations).values({
    name: 'Parameter Organization',
    slug: `parameter-${crypto.randomUUID()}`,
  }).returning();
  const [project] = await db.insert(schema.projects).values({
    organizationId: organization.id,
    name: 'Parameter Project',
    slug: `parameter-${crypto.randomUUID()}`,
  }).returning();
  const users: Record<string, { id: string }> = {};
  for (const [key, role] of Object.entries(roleAssignments)) {
    const [user] = await db.insert(schema.users).values({
      email: `parameter-${key}-${crypto.randomUUID()}@example.test`,
      name: `Parameter ${key}`,
    }).returning();
    await db.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role,
    });
    users[key] = user;
  }
  async function cleanup() {
    const userIds = Object.values(users).map((user) => user.id);
    await db.delete(schema.auditLogs).where(eq(schema.auditLogs.organizationId, organization.id));
    if (userIds.length > 0) {
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.userId, userIds));
    }
    await db.delete(schema.projectParameterActivation).where(eq(schema.projectParameterActivation.projectId, project.id));
    await db.execute(sql`ALTER TABLE parameter_versions DISABLE TRIGGER parameter_versions_immutable_guard_trigger`);
    try {
      await db.delete(schema.parameterVersions).where(and(
        eq(schema.parameterVersions.organizationId, organization.id),
        eq(schema.parameterVersions.projectId, project.id),
      ));
    } finally {
      await db.execute(sql`ALTER TABLE parameter_versions ENABLE TRIGGER parameter_versions_immutable_guard_trigger`);
    }
    await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, organization.id));
    await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, organization.id));
    for (const user of Object.values(users)) {
      await db.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  }
  return { organization, project, users, cleanup };
}

integration('parameter version service', () => {
  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it('creates, validates, activates, resolves, rolls back, and enforces RBAC', async () => {
    if (!database) throw new Error('The integration database is not configured.');
    process.env.AUTH_SECRET ??= 'integration-only-secret';
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    const {
      activateParameterVersion,
      createParameterVersion,
      resolveActiveParameterVersion,
      rollbackParameterVersion,
      validateParameterVersion,
    } = await import('./parameter-version');
    const [owner] = await database.insert(schema.users).values({
      email: `parameter-owner-${crypto.randomUUID()}@example.test`,
      name: 'Parameter Owner',
    }).returning();
    const [member] = await database.insert(schema.users).values({
      email: `parameter-member-${crypto.randomUUID()}@example.test`,
      name: 'Parameter Member',
    }).returning();
    const [organization] = await database.insert(schema.organizations).values({
      name: 'Parameter Organization',
      slug: `parameter-${crypto.randomUUID()}`,
    }).returning();
    const [project] = await database.insert(schema.projects).values({
      organizationId: organization.id,
      name: 'Parameter Project',
      slug: `parameter-${crypto.randomUUID()}`,
    }).returning();

    try {
      await database.insert(schema.organizationMembers).values([
        { organizationId: organization.id, userId: owner.id, role: 'OWNER' },
        { organizationId: organization.id, userId: member.id, role: 'MEMBER' },
      ]);
      const first = await createParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        version: 'v1',
        parameterSet: parameterSet('v1'),
      });
      expect(first.status).toBe('CANDIDATE');
      const validatedFirst = await validateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: first.id,
      });
      expect(validatedFirst.status).toBe('VALIDATED');
      await expect(database.update(schema.parameterVersions).set({
        parameterSetHash: 'tampered',
      }).where(eq(schema.parameterVersions.id, first.id))).rejects.toThrow();
      await expect(database.delete(schema.parameterVersions).where(
        eq(schema.parameterVersions.id, first.id),
      )).rejects.toThrow();
      await activateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: first.id,
      });
      expect((await resolveActiveParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
      })).version).toBe('v1');

      const second = await createParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        version: 'v2',
        parameterSet: parameterSet('v2'),
        parentVersionId: first.id,
      });
      await validateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: second.id,
      });
      const third = await createParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        version: 'v3',
        parameterSet: parameterSet('v3'),
        parentVersionId: second.id,
      });
      await validateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: third.id,
      });
      const fourth = await createParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        version: 'v4',
        parameterSet: parameterSet('v4'),
        parentVersionId: third.id,
      });
      await validateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: fourth.id,
      });
      const concurrentActivations = await Promise.allSettled([
        activateParameterVersion({
          userId: owner.id,
          organizationId: organization.id,
          projectId: project.id,
          parameterVersionId: third.id,
        }),
        activateParameterVersion({
          userId: owner.id,
          organizationId: organization.id,
          projectId: project.id,
          parameterVersionId: fourth.id,
        }),
      ]);
      expect(concurrentActivations.some((result) => result.status === 'fulfilled')).toBe(true);
      await activateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: second.id,
      });
      await rollbackParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: first.id,
        reason: 'restore previous validated version',
      });
      expect((await resolveActiveParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
      })).version).toBe('v1');
      await expect(activateParameterVersion({
        userId: member.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: second.id,
      })).rejects.toThrow();
      const candidate = await createParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        version: 'candidate',
        parameterSet: parameterSet('candidate'),
      });
      await expect(activateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: candidate.id,
      })).rejects.toThrow();
      await database.update(schema.parameterVersions).set({
        status: 'REJECTED',
        rejectionReason: 'test rejection',
        rejectedAt: new Date(),
        rejectedBy: owner.id,
      }).where(eq(schema.parameterVersions.id, candidate.id));
      await expect(database.update(schema.parameterVersions).set({
        rejectionReason: 'tampered',
      }).where(eq(schema.parameterVersions.id, candidate.id))).rejects.toThrow();
      await expect(database.delete(schema.parameterVersions).where(
        eq(schema.parameterVersions.id, candidate.id),
      )).rejects.toThrow();
      await expect(activateParameterVersion({
        userId: owner.id,
        organizationId: organization.id,
        projectId: project.id,
        parameterVersionId: crypto.randomUUID(),
      })).rejects.toThrow();
      const failureAudits = await database.select().from(schema.auditLogs)
        .where(eq(schema.auditLogs.organizationId, organization.id));
      expect(failureAudits.filter(
        (audit) => audit.action === 'parameter_version_activation_failed',
      ).length).toBeGreaterThanOrEqual(3);
      const pointers = await database.select().from(schema.projectParameterActivation)
        .where(eq(schema.projectParameterActivation.projectId, project.id));
      expect(pointers).toHaveLength(1);
    } finally {
      await database.delete(schema.auditLogs).where(eq(schema.auditLogs.organizationId, organization.id));
      await database.delete(schema.projectParameterActivation).where(eq(schema.projectParameterActivation.projectId, project.id));
      await database.execute(sql`ALTER TABLE parameter_versions DISABLE TRIGGER parameter_versions_immutable_guard_trigger`);
      try {
        await database.delete(schema.parameterVersions).where(and(
          eq(schema.parameterVersions.organizationId, organization.id),
          eq(schema.parameterVersions.projectId, project.id),
        ));
      } finally {
        await database.execute(sql`ALTER TABLE parameter_versions ENABLE TRIGGER parameter_versions_immutable_guard_trigger`);
      }
      await database.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, organization.id));
      await database.delete(schema.projects).where(eq(schema.projects.id, project.id));
      await database.delete(schema.organizations).where(eq(schema.organizations.id, organization.id));
      await database.delete(schema.users).where(eq(schema.users.id, owner.id));
      await database.delete(schema.users).where(eq(schema.users.id, member.id));
    }
  });

  it('allows ADMIN to activate and rollback, and rejects VIEWER and MEMBER for both operations', async () => {
    if (!database) throw new Error('The integration database is not configured.');
    const fixture = await createFixture({
      owner: 'OWNER',
      admin: 'ADMIN',
      member: 'MEMBER',
      viewer: 'VIEWER',
    });
    const {
      activateParameterVersion,
      createParameterVersion,
      rollbackParameterVersion,
      validateParameterVersion,
    } = await import('./parameter-version');
    try {
      const v1 = await createParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        version: 'rbac-v1',
        parameterSet: parameterSet('rbac-v1'),
      });
      await validateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
      });
      const v2 = await createParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        version: 'rbac-v2',
        parameterSet: parameterSet('rbac-v2'),
        parentVersionId: v1.id,
      });
      await validateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
      });

      await activateParameterVersion({
        userId: fixture.users.admin.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
      });
      await activateParameterVersion({
        userId: fixture.users.admin.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
      });
      await rollbackParameterVersion({
        userId: fixture.users.admin.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
        reason: 'admin rollback',
      });

      await expect(activateParameterVersion({
        userId: fixture.users.viewer.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
      })).rejects.toThrow();
      await expect(rollbackParameterVersion({
        userId: fixture.users.viewer.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
        reason: 'viewer rollback',
      })).rejects.toThrow();
      await expect(rollbackParameterVersion({
        userId: fixture.users.member.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
        reason: 'member rollback',
      })).rejects.toThrow();
    } finally {
      await fixture.cleanup();
    }
  });

  it('rejects cross-organization and cross-project activation and resolution (IDOR)', async () => {
    if (!database) throw new Error('The integration database is not configured.');
    const fixtureA = await createFixture({ owner: 'OWNER' });
    const fixtureB = await createFixture({ owner: 'OWNER' });
    const [project2] = await database.insert(schema.projects).values({
      organizationId: fixtureA.organization.id,
      name: 'Parameter Project 2',
      slug: `parameter-2-${crypto.randomUUID()}`,
    }).returning();
    const {
      activateParameterVersion,
      createParameterVersion,
      resolveActiveParameterVersion,
      validateParameterVersion,
    } = await import('./parameter-version');
    try {
      const version = await createParameterVersion({
        userId: fixtureA.users.owner.id,
        organizationId: fixtureA.organization.id,
        projectId: fixtureA.project.id,
        version: 'idor-v1',
        parameterSet: parameterSet('idor-v1'),
      });
      await validateParameterVersion({
        userId: fixtureA.users.owner.id,
        organizationId: fixtureA.organization.id,
        projectId: fixtureA.project.id,
        parameterVersionId: version.id,
      });

      // Actor with no membership in organization A must be rejected outright.
      await expect(activateParameterVersion({
        userId: fixtureB.users.owner.id,
        organizationId: fixtureB.organization.id,
        projectId: fixtureA.project.id,
        parameterVersionId: version.id,
      })).rejects.toThrow();

      // Legitimate actor in organization A, but organizationId argument spoofed to organization B.
      await expect(activateParameterVersion({
        userId: fixtureA.users.owner.id,
        organizationId: fixtureB.organization.id,
        projectId: fixtureA.project.id,
        parameterVersionId: version.id,
      })).rejects.toThrow();

      // Legitimate actor in organization A, valid second project in the same organization,
      // but the parameter version is scoped to the first project only.
      await expect(activateParameterVersion({
        userId: fixtureA.users.owner.id,
        organizationId: fixtureA.organization.id,
        projectId: project2.id,
        parameterVersionId: version.id,
      })).rejects.toThrow();

      await activateParameterVersion({
        userId: fixtureA.users.owner.id,
        organizationId: fixtureA.organization.id,
        projectId: fixtureA.project.id,
        parameterVersionId: version.id,
      });

      // Resolution must reject a mismatched organization scope even for a legitimate actor.
      await expect(resolveActiveParameterVersion({
        userId: fixtureA.users.owner.id,
        organizationId: fixtureB.organization.id,
        projectId: fixtureA.project.id,
      })).rejects.toThrow();
    } finally {
      await database.delete(schema.projects).where(eq(schema.projects.id, project2.id));
      await fixtureA.cleanup();
      await fixtureB.cleanup();
    }
  });

  it('rolls back the entire activation transaction when the audit write fails atomically', async () => {
    if (!database) throw new Error('The integration database is not configured.');
    const db = database;
    const fixture = await createFixture({ owner: 'OWNER' });
    const {
      activateParameterVersion,
      createParameterVersion,
      resolveActiveParameterVersion,
      validateParameterVersion,
    } = await import('./parameter-version');
    try {
      const v1 = await createParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        version: 'audit-v1',
        parameterSet: parameterSet('audit-v1'),
      });
      await validateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
      });
      await activateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
      });
      const v2 = await createParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        version: 'audit-v2',
        parameterSet: parameterSet('audit-v2'),
        parentVersionId: v1.id,
      });
      await validateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
      });

      await db.execute(sql`ALTER TABLE audit_logs ADD CONSTRAINT test_block_audit_sentinel CHECK (metadata->>'reason' IS DISTINCT FROM '__forceAuditFailure__')`);
      try {
        await expect(activateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          parameterVersionId: v2.id,
          reason: '__forceAuditFailure__',
        })).rejects.toThrow();
      } finally {
        await db.execute(sql`ALTER TABLE audit_logs DROP CONSTRAINT test_block_audit_sentinel`);
      }

      expect((await resolveActiveParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
      })).version).toBe('audit-v1');
      const pointers = await db.select().from(schema.projectParameterActivation)
        .where(eq(schema.projectParameterActivation.projectId, fixture.project.id));
      expect(pointers).toHaveLength(1);
      expect(pointers[0].parameterVersionId).toBe(v1.id);
      const activatedAudits = await db.select().from(schema.auditLogs).where(and(
        eq(schema.auditLogs.organizationId, fixture.organization.id),
        eq(schema.auditLogs.action, 'parameter_version_activated'),
        eq(schema.auditLogs.resourceId, v2.id),
      ));
      expect(activatedAudits).toHaveLength(0);
      const failureAudits = await db.select().from(schema.auditLogs).where(and(
        eq(schema.auditLogs.organizationId, fixture.organization.id),
        eq(schema.auditLogs.action, 'parameter_version_activation_failed'),
        eq(schema.auditLogs.resourceId, v2.id),
      ));
      expect(failureAudits.length).toBeGreaterThanOrEqual(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it('handles concurrent activation, concurrent activate+rollback, and cross-project isolation without corruption', async () => {
    if (!database) throw new Error('The integration database is not configured.');
    const db = database;
    const fixture = await createFixture({ owner: 'OWNER' });
    const [project2] = await db.insert(schema.projects).values({
      organizationId: fixture.organization.id,
      name: 'Parameter Project 2',
      slug: `parameter-2-${crypto.randomUUID()}`,
    }).returning();
    const {
      activateParameterVersion,
      createParameterVersion,
      resolveActiveParameterVersion,
      rollbackParameterVersion,
      validateParameterVersion,
    } = await import('./parameter-version');
    try {
      const mk = async (version: string, projectId: string, parentVersionId?: string) => {
        const created = await createParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId,
          version,
          parameterSet: parameterSet(version),
          parentVersionId,
        });
        await validateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId,
          parameterVersionId: created.id,
        });
        return created;
      };
      const v1 = await mk('conc-v1', fixture.project.id);
      const v2 = await mk('conc-v2', fixture.project.id, v1.id);
      const p2v1 = await mk('conc-p2-v1', project2.id);

      const concurrentActivations = await Promise.allSettled([
        activateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          parameterVersionId: v1.id,
        }),
        activateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          parameterVersionId: v2.id,
        }),
      ]);
      expect(concurrentActivations.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      let pointers = await db.select().from(schema.projectParameterActivation)
        .where(eq(schema.projectParameterActivation.projectId, fixture.project.id));
      expect(pointers).toHaveLength(1);
      expect(['conc-v1', 'conc-v2']).toContain((await resolveActiveParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
      })).version);

      const concurrentPair = await Promise.allSettled([
        activateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          parameterVersionId: v2.id,
        }),
        rollbackParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          parameterVersionId: v1.id,
          reason: 'concurrent rollback',
        }),
      ]);
      expect(concurrentPair.some((r) => r.status === 'fulfilled')).toBe(true);
      pointers = await db.select().from(schema.projectParameterActivation)
        .where(eq(schema.projectParameterActivation.projectId, fixture.project.id));
      expect(pointers).toHaveLength(1);
      expect(['conc-v1', 'conc-v2']).toContain((await resolveActiveParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
      })).version);

      const crossProject = await Promise.allSettled([
        activateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          parameterVersionId: v1.id,
        }),
        activateParameterVersion({
          userId: fixture.users.owner.id,
          organizationId: fixture.organization.id,
          projectId: project2.id,
          parameterVersionId: p2v1.id,
        }),
      ]);
      expect(crossProject.every((r) => r.status === 'fulfilled')).toBe(true);
      expect((await resolveActiveParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
      })).version).toBe('conc-v1');
      expect((await resolveActiveParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: project2.id,
      })).version).toBe('conc-p2-v1');
      const p2Pointers = await db.select().from(schema.projectParameterActivation)
        .where(eq(schema.projectParameterActivation.projectId, project2.id));
      expect(p2Pointers).toHaveLength(1);
    } finally {
      await db.delete(schema.projectParameterActivation).where(eq(schema.projectParameterActivation.projectId, project2.id));
      await db.execute(sql`ALTER TABLE parameter_versions DISABLE TRIGGER parameter_versions_immutable_guard_trigger`);
      try {
        await db.delete(schema.parameterVersions).where(and(
          eq(schema.parameterVersions.organizationId, fixture.organization.id),
          eq(schema.parameterVersions.projectId, project2.id),
        ));
      } finally {
        await db.execute(sql`ALTER TABLE parameter_versions ENABLE TRIGGER parameter_versions_immutable_guard_trigger`);
      }
      await db.delete(schema.projects).where(eq(schema.projects.id, project2.id));
      await fixture.cleanup();
    }
  });

  it('preserves the exact historical snapshot of a version across rollback with field-level equality', async () => {
    if (!database) throw new Error('The integration database is not configured.');
    const db = database;
    const fixture = await createFixture({ owner: 'OWNER' });
    const {
      activateParameterVersion,
      createParameterVersion,
      rollbackParameterVersion,
      validateParameterVersion,
    } = await import('./parameter-version');
    try {
      const v1 = await createParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        version: 'immut-v1',
        parameterSet: parameterSet('immut-v1'),
      });
      await validateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
      });
      await activateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
      });
      const v2 = await createParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        version: 'immut-v2',
        parameterSet: parameterSet('immut-v2'),
        parentVersionId: v1.id,
      });
      await validateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
      });
      await activateParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v2.id,
      });

      const [before] = await db.select().from(schema.parameterVersions)
        .where(eq(schema.parameterVersions.id, v1.id));

      await rollbackParameterVersion({
        userId: fixture.users.owner.id,
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        parameterVersionId: v1.id,
        reason: 'field level rollback check',
      });

      const [after] = await db.select().from(schema.parameterVersions)
        .where(eq(schema.parameterVersions.id, v1.id));
      expect(after).toEqual(before);
    } finally {
      await fixture.cleanup();
    }
  });
});
