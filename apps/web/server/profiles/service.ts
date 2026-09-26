import { createPersonalityProfile } from '@emora/emotional-core';
import {
  auditLogs,
  db,
  emotionalProfiles,
  organizationMembers,
  projects,
} from '@emora/database';
import { asc, eq } from 'drizzle-orm';

import { ProfileError } from './errors';
import type { AcceptedCreateProfileRequest } from './validation';

/**
 * Slice 3 discovery and minimal profile onboarding service.
 *
 * - listAuthorizedProjects / listProjectProfiles: read-only, membership-scoped
 *   discovery. Complete lists ordered `createdAt ASC, id ASC`; no pagination.
 * - createProjectProfile: the single Slice 3 write. Profile insert and its
 *   exactly-one success audit row share one database transaction; an audit
 *   failure rolls back the profile (fail-closed, never swallowed).
 *
 * Audit metadata is an explicit operational-identifier allow-list only
 * (`projectId`, `profileId`, `requestId`, `outcome`). No profileData,
 * personality values, additionalTraits, emotional vectors, context, or secrets.
 * Invalid input and duplicate attempts write no audit rows and persist nothing.
 */

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ProjectListItem {
  readonly projectId: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
}

export interface ProfileListItem {
  readonly profileId: string;
  readonly externalReference: string;
  readonly createdAt: string;
}

export interface ProjectsListResponseBody {
  readonly requestId: string;
  readonly projects: readonly ProjectListItem[];
}

export interface ProfilesListResponseBody {
  readonly requestId: string;
  readonly profiles: readonly ProfileListItem[];
}

export interface ProfileCreateResponseBody {
  readonly requestId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly externalReference: string;
  readonly createdAt: string;
}

export interface ProfileCreateServiceResult {
  readonly status: 201;
  readonly body: ProfileCreateResponseBody;
  readonly profileId: string;
}

function isUniqueViolation(error: unknown): boolean {
  // SQLSTATE 23505 may surface directly or wrapped in an error cause chain
  // (driver/transaction wrappers). Walk a bounded depth; never inspect more.
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Projects the user may use: joined through organization membership only.
 * Server-derived scope; never filtered by client input.
 */
export async function listAuthorizedProjects(input: {
  userId: string;
  requestId: string;
}): Promise<{ status: 200; body: ProjectsListResponseBody }> {
  const rows = await db
    .select({
      projectId: projects.id,
      name: projects.name,
      slug: projects.slug,
      createdAt: projects.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(
      projects,
      eq(projects.organizationId, organizationMembers.organizationId),
    )
    .where(eq(organizationMembers.userId, input.userId))
    .orderBy(asc(projects.createdAt), asc(projects.id));

  return {
    status: 200,
    body: {
      requestId: input.requestId,
      projects: rows.map((row) => ({
        projectId: row.projectId,
        name: row.name,
        slug: row.slug,
        createdAt: row.createdAt.toISOString(),
      })),
    },
  };
}

/**
 * Profiles of exactly one project. Callers must have already authorized the
 * project (route layer). The query is constrained to the project id, so a
 * profile of another project can never appear here.
 */
export async function listProjectProfiles(input: {
  projectId: string;
  requestId: string;
}): Promise<{ status: 200; body: ProfilesListResponseBody }> {
  const rows = await db
    .select({
      profileId: emotionalProfiles.id,
      externalReference: emotionalProfiles.externalReference,
      createdAt: emotionalProfiles.createdAt,
    })
    .from(emotionalProfiles)
    .where(eq(emotionalProfiles.projectId, input.projectId))
    .orderBy(asc(emotionalProfiles.createdAt), asc(emotionalProfiles.id));

  return {
    status: 200,
    body: {
      requestId: input.requestId,
      profiles: rows.map((row) => ({
        profileId: row.profileId,
        externalReference: row.externalReference,
        createdAt: row.createdAt.toISOString(),
      })),
    },
  };
}

export interface ProfileCreateServiceInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly requestId: string;
  readonly request: AcceptedCreateProfileRequest;
}

/**
 * Create one immutable profile. Single transaction:
 *   1. insert the profile row;
 *   2. insert exactly one `emotional_profile.created` audit row.
 * Any failure — including the audit insert — rolls back both. A duplicate
 * (projectId, externalReference) maps to `external_reference_conflict` (409)
 * via the unique-index violation; no audit row is written on that path.
 */
export async function createProjectProfile(
  input: ProfileCreateServiceInput,
): Promise<ProfileCreateServiceResult> {
  const profileId = crypto.randomUUID();

  // Authoritative domain validation before any write: re-checks the six
  // computational parameters and optional additionalTraits in [0,1] (fail
  // closed; no defaults, no clamping). A rejection here is an invalid request
  // (400), never a stored-data integrity failure.
  let domainProfile: ReturnType<typeof createPersonalityProfile>;
  try {
    domainProfile = createPersonalityProfile({
      id: profileId,
      emotionalSensitivity:
        input.request.personalityProfile.emotionalSensitivity,
      baselineTrust: input.request.personalityProfile.baselineTrust,
      baselineAnxiety: input.request.personalityProfile.baselineAnxiety,
      attachmentSensitivity:
        input.request.personalityProfile.attachmentSensitivity,
      nostalgiaSensitivity:
        input.request.personalityProfile.nostalgiaSensitivity,
      jealousySensitivity:
        input.request.personalityProfile.jealousySensitivity,
      ...(input.request.additionalTraits
        ? { additionalTraits: input.request.additionalTraits }
        : {}),
    });
  } catch {
    throw new ProfileError('invalid_input');
  }

  // Persisted profileData uses the frozen Slice 1 structure consumed unchanged
  // by toPersonalityProfile: { personalityProfile: { six, additionalTraits? } }.
  const profileData = {
    personalityProfile: {
      emotionalSensitivity: domainProfile.emotionalSensitivity,
      baselineTrust: domainProfile.baselineTrust,
      baselineAnxiety: domainProfile.baselineAnxiety,
      attachmentSensitivity: domainProfile.attachmentSensitivity,
      nostalgiaSensitivity: domainProfile.nostalgiaSensitivity,
      jealousySensitivity: domainProfile.jealousySensitivity,
      ...(domainProfile.additionalTraits
        ? { additionalTraits: { ...domainProfile.additionalTraits } }
        : {}),
    },
  };

  try {
    return await db.transaction(async (tx: Transaction) => {
      // 1. Insert the profile row (duplicate protection: unique index
      //    emotional_profiles_project_external_reference_unique).
      const [profileRow] = await tx
        .insert(emotionalProfiles)
        .values({
          id: profileId,
          projectId: input.projectId,
          externalReference: input.request.externalReference,
          profileData: profileData as unknown as Record<string, unknown>,
        })
        .returning({
          id: emotionalProfiles.id,
          createdAt: emotionalProfiles.createdAt,
        });

      // 2. Creation audit. In-transaction: an audit failure rolls back the
      //    profile row (never swallowed). Metadata allow-list only.
      await tx.insert(auditLogs).values({
        organizationId: input.organizationId,
        userId: input.userId,
        action: 'emotional_profile.created',
        resourceType: 'emotional_profile',
        resourceId: profileRow.id,
        metadata: {
          projectId: input.projectId,
          profileId: profileRow.id,
          requestId: input.requestId,
          outcome: 'succeeded',
        },
      });

      return {
        status: 201 as const,
        body: {
          requestId: input.requestId,
          projectId: input.projectId,
          profileId: profileRow.id,
          externalReference: input.request.externalReference,
          createdAt: profileRow.createdAt.toISOString(),
        },
        profileId: profileRow.id,
      };
    });
  } catch (error) {
    if (error instanceof ProfileError) throw error;
    if (isUniqueViolation(error)) {
      throw new ProfileError('external_reference_conflict');
    }
    throw new ProfileError('internal_error');
  }
}
