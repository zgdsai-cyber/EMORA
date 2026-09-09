import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import {
  auditLogs,
  db,
  parameterVersions,
  projectParameterActivation,
  projects,
} from '@emora/database';
import type { ParameterVersion } from '@emora/database/schema';
import {
  createLearnableParameterSet,
  type LearnableParameterSet,
} from '@emora/emotional-core';

import { requireProjectAccess } from './authorization';

export type ParameterVersionStatus = 'CANDIDATE' | 'VALIDATED' | 'REJECTED';

export interface ParameterEvaluationReport {
  readonly validatorVersion: string;
  readonly parameterSetHash: string;
  readonly checks: Readonly<{
    deterministic: true;
    numericBounds: true;
    interactionPolicy: true;
    runtimeValidation: true;
    hashValidation: true;
  }>;
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Cannot hash non-finite values.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(',')}}`;
  }
  throw new TypeError('Cannot hash unsupported parameter values.');
}

export function hashLearnableParameterSet(parameterSet: LearnableParameterSet): string {
  const validated = createLearnableParameterSet(parameterSet);
  return createHash('sha256').update(canonicalize(validated)).digest('hex');
}

function evaluationReport(parameterSetHash: string): ParameterEvaluationReport {
  return {
    validatorVersion: 'phase-6.2-b-1',
    parameterSetHash,
    checks: {
      deterministic: true,
      numericBounds: true,
      interactionPolicy: true,
      runtimeValidation: true,
      hashValidation: true,
    },
  };
}

function snapshotAsJson(parameterSet: LearnableParameterSet): Record<string, unknown> {
  return parameterSet as unknown as Record<string, unknown>;
}

function assertStatus(status: string, expected: ParameterVersionStatus): void {
  if (status !== expected) {
    throw new Error(`Parameter version must be ${expected}; received ${status}.`);
  }
}

async function writeAudit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    organizationId: string;
    userId: string;
    resourceId?: string;
    action: string;
    metadata: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    organizationId: input.organizationId,
    userId: input.userId,
    resourceId: input.resourceId,
    action: input.action,
    resourceType: 'parameter_version',
    metadata: input.metadata,
  });
}

async function writeActivationFailure(input: {
  organizationId: string;
  projectId: string;
  userId: string;
  parameterVersionId: string;
  reason: string;
}) {
  try {
    await db.insert(auditLogs).values({
      organizationId: input.organizationId,
      userId: input.userId,
      resourceId: input.parameterVersionId,
      action: 'parameter_version_activation_failed',
      resourceType: 'parameter_version',
      metadata: {
        projectId: input.projectId,
        parameterVersionId: input.parameterVersionId,
        reason: input.reason,
      },
    });
  } catch {
    // Preserve the activation error if the separate failure audit also fails.
  }
}

export async function createParameterVersion(input: {
  userId: string;
  organizationId: string;
  projectId: string;
  version: string;
  parameterSet: LearnableParameterSet;
  parentVersionId?: string;
}): Promise<ParameterVersion> {
  const access = await requireProjectAccess(input.userId, input.projectId, 'ADMIN');
  if (access.project.organizationId !== input.organizationId) {
    throw new Error('Parameter version organization scope is invalid.');
  }
  const parameterSet = createLearnableParameterSet(input.parameterSet);
  const parameterSetHash = hashLearnableParameterSet(parameterSet);

  return db.transaction(async (tx) => {
    if (input.parentVersionId) {
      const parent = await tx.query.parameterVersions.findFirst({
        where: and(
          eq(parameterVersions.id, input.parentVersionId),
          eq(parameterVersions.organizationId, input.organizationId),
          eq(parameterVersions.projectId, input.projectId),
        ),
      });
      if (!parent) throw new Error('Parent parameter version is out of scope.');
    }
    const [created] = await tx.insert(parameterVersions).values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      version: input.version,
      parameterSet: snapshotAsJson(parameterSet),
      parameterSetHash,
      status: 'CANDIDATE',
      parentVersionId: input.parentVersionId,
      createdBy: input.userId,
    }).returning();
    await writeAudit(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      resourceId: created.id,
      action: 'parameter_version_created',
      metadata: { projectId: input.projectId, parameterSetHash },
    });
    return created;
  });
}

export async function validateParameterVersion(input: {
  userId: string;
  organizationId: string;
  projectId: string;
  parameterVersionId: string;
}): Promise<ParameterVersion> {
  await requireProjectAccess(input.userId, input.projectId, 'ADMIN');
  return db.transaction(async (tx) => {
    const [version] = await tx.select().from(parameterVersions).where(and(
      eq(parameterVersions.id, input.parameterVersionId),
      eq(parameterVersions.organizationId, input.organizationId),
      eq(parameterVersions.projectId, input.projectId),
    )).for('update');
    if (!version) throw new Error('Parameter version not found.');
    assertStatus(version.status, 'CANDIDATE');
    try {
      const parameterSet = createLearnableParameterSet(version.parameterSet as unknown as LearnableParameterSet);
      const computedHash = hashLearnableParameterSet(parameterSet);
      if (computedHash !== version.parameterSetHash) throw new Error('Parameter version hash mismatch.');
      const report = evaluationReport(computedHash);
      const [updated] = await tx.update(parameterVersions).set({
        status: 'VALIDATED',
        validatedAt: new Date(),
        validatedBy: input.userId,
        evaluationReport: report as unknown as Record<string, unknown>,
      }).where(eq(parameterVersions.id, version.id)).returning();
      await writeAudit(tx, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceId: version.id,
        action: 'parameter_version_validated',
        metadata: { projectId: input.projectId, parameterSetHash: computedHash },
      });
      return updated;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Validation failed.';
      await tx.update(parameterVersions).set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: input.userId,
        rejectionReason: reason,
      }).where(eq(parameterVersions.id, version.id));
      await writeAudit(tx, {
        organizationId: input.organizationId,
        userId: input.userId,
        resourceId: version.id,
        action: 'parameter_version_rejected',
        metadata: { projectId: input.projectId, reason },
      });
      const [rejected] = await tx.select().from(parameterVersions).where(
        eq(parameterVersions.id, version.id),
      );
      if (!rejected) throw error;
      return rejected;
    }
  });
}

export async function activateParameterVersion(input: {
  userId: string;
  organizationId: string;
  projectId: string;
  parameterVersionId: string;
  reason?: string;
  auditAction?: 'parameter_version_activated' | 'parameter_version_rollback';
}): Promise<ParameterVersion> {
  try {
    await requireProjectAccess(input.userId, input.projectId, 'ADMIN');
    return await db.transaction(async (tx) => {
    const [lockedProject] = await tx.select({ id: projects.id }).from(projects)
      .where(and(
        eq(projects.id, input.projectId),
        eq(projects.organizationId, input.organizationId),
      ))
      .for('update');
    if (!lockedProject) throw new Error('Project not found.');
    const [version] = await tx.select().from(parameterVersions).where(and(
      eq(parameterVersions.id, input.parameterVersionId),
      eq(parameterVersions.organizationId, input.organizationId),
      eq(parameterVersions.projectId, input.projectId),
    )).for('update');
    if (!version) throw new Error('Parameter version not found.');
    assertStatus(version.status, 'VALIDATED');
    const parameterSet = createLearnableParameterSet(version.parameterSet as unknown as LearnableParameterSet);
    const computedHash = hashLearnableParameterSet(parameterSet);
    if (computedHash !== version.parameterSetHash) throw new Error('Parameter version hash mismatch.');
    const [current] = await tx.select().from(projectParameterActivation)
      .where(eq(projectParameterActivation.projectId, input.projectId))
      .for('update');
    if (current?.parameterVersionId === version.id) return version;
    await tx.insert(projectParameterActivation).values({
      projectId: input.projectId,
      organizationId: input.organizationId,
      parameterVersionId: version.id,
      activatedBy: input.userId,
    }).onConflictDoUpdate({
      target: projectParameterActivation.projectId,
      set: {
        organizationId: input.organizationId,
        parameterVersionId: version.id,
        activatedAt: new Date(),
        activatedBy: input.userId,
      },
    });
    await writeAudit(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      resourceId: version.id,
      action: input.auditAction ?? 'parameter_version_activated',
      metadata: {
        projectId: input.projectId,
        previousVersionId: current?.parameterVersionId,
        newActiveVersionId: version.id,
        reason: input.reason,
        parameterSetHash: computedHash,
      },
    });
      return version;
    });
  } catch (error) {
    await writeActivationFailure({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      parameterVersionId: input.parameterVersionId,
      reason: error instanceof Error ? error.message : 'Activation failed.',
    });
    throw error;
  }
}

export async function rollbackParameterVersion(input: Parameters<typeof activateParameterVersion>[0]) {
  return activateParameterVersion({ ...input, auditAction: 'parameter_version_rollback' });
}

export async function resolveActiveParameterVersion(input: {
  userId: string;
  organizationId: string;
  projectId: string;
}): Promise<LearnableParameterSet> {
  const access = await requireProjectAccess(input.userId, input.projectId, 'VIEWER');
  if (access.project.organizationId !== input.organizationId) {
    throw new Error('Active parameter version organization scope is invalid.');
  }
  const [activation] = await db.select().from(projectParameterActivation)
    .where(and(
      eq(projectParameterActivation.projectId, input.projectId),
      eq(projectParameterActivation.organizationId, input.organizationId),
    ));
  if (!activation) throw new Error('No active parameter version exists.');
  const [version] = await db.select().from(parameterVersions).where(and(
    eq(parameterVersions.id, activation.parameterVersionId),
    eq(parameterVersions.organizationId, input.organizationId),
    eq(parameterVersions.projectId, input.projectId),
  ));
  if (!version) throw new Error('Active parameter version is missing.');
  assertStatus(version.status, 'VALIDATED');
  const parameterSet = createLearnableParameterSet(version.parameterSet as unknown as LearnableParameterSet);
  if (hashLearnableParameterSet(parameterSet) !== version.parameterSetHash) {
    throw new Error('Active parameter version hash mismatch.');
  }
  return parameterSet;
}