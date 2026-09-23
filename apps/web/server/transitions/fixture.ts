import {
  db,
  emotionalProfiles,
  organizationMembers,
  organizations,
  projects,
} from '@emora/database';
import { and, eq } from 'drizzle-orm';

/**
 * SLICE 1 CONTROLLED DEVELOPMENT/TEST FIXTURE — NOT PRODUCTION PROVISIONING.
 *
 * The repository intentionally has no organization/project/profile
 * administration. Slice 1 therefore ships the smallest controlled fixture
 * needed to exercise the vertical slice end to end. It is idempotent,
 * additive, and never runs as part of the product API surface.
 */

export const CONTROLLED_FIXTURE = Object.freeze({
  organizationName: 'Slice 1 Controlled Development Organization',
  organizationSlug: 'slice1-controlled-development',
  projectName: 'Slice 1 Controlled Development Project',
  projectSlug: 'slice1-controlled-development',
  profileExternalReference: 'slice1-controlled-profile',
});

/**
 * Frozen Slice 1 profile-data contract. Structural data only: the six required
 * model traits plus an optional additionalTraits block. These are model inputs,
 * not psychological measurements, and no trait here is a default for other
 * profiles.
 */
export const CONTROLLED_PROFILE_DATA = Object.freeze({
  personalityProfile: Object.freeze({
    emotionalSensitivity: 0.8,
    baselineTrust: 0.6,
    baselineAnxiety: 0.4,
    attachmentSensitivity: 0.7,
    nostalgiaSensitivity: 0.6,
    jealousySensitivity: 0.7,
    additionalTraits: Object.freeze({ openness: 0.5 }),
  }),
});

export interface ControlledWorkspace {
  readonly organizationId: string;
  readonly projectId: string;
  readonly profileId: string;
}

export async function ensureControlledFixture(): Promise<ControlledWorkspace> {
  const [existingOrganization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, CONTROLLED_FIXTURE.organizationSlug))
    .limit(1);
  let organizationId = existingOrganization?.id;
  if (!organizationId) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: CONTROLLED_FIXTURE.organizationName,
        slug: CONTROLLED_FIXTURE.organizationSlug,
      })
      .returning({ id: organizations.id });
    organizationId = created.id;
  }

  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(projects.slug, CONTROLLED_FIXTURE.projectSlug),
      ),
    )
    .limit(1);
  let projectId = existingProject?.id;
  if (!projectId) {
    const [created] = await db
      .insert(projects)
      .values({
        organizationId,
        name: CONTROLLED_FIXTURE.projectName,
        slug: CONTROLLED_FIXTURE.projectSlug,
      })
      .returning({ id: projects.id });
    projectId = created.id;
  }

  const [existingProfile] = await db
    .select({ id: emotionalProfiles.id })
    .from(emotionalProfiles)
    .where(
      and(
        eq(emotionalProfiles.projectId, projectId),
        eq(
          emotionalProfiles.externalReference,
          CONTROLLED_FIXTURE.profileExternalReference,
        ),
      ),
    )
    .limit(1);
  let profileId = existingProfile?.id;
  if (!profileId) {
    const [created] = await db
      .insert(emotionalProfiles)
      .values({
        projectId,
        externalReference: CONTROLLED_FIXTURE.profileExternalReference,
        profileData: CONTROLLED_PROFILE_DATA as unknown as Record<
          string,
          unknown
        >,
      })
      .returning({ id: emotionalProfiles.id });
    profileId = created.id;
  }

  return { organizationId, projectId, profileId };
}

export async function grantControlledMembership(
  workspace: ControlledWorkspace,
  userId: string,
): Promise<void> {
  await db
    .insert(organizationMembers)
    .values({
      organizationId: workspace.organizationId,
      userId,
      role: 'MEMBER',
    })
    .onConflictDoNothing({
      target: [organizationMembers.organizationId, organizationMembers.userId],
    });
}

/**
 * Read-only resolution of a workspace the user is already authorized for.
 * Returns undefined when nothing is available (the UI then shows its controlled
 * empty state) — this is never used to authorize: the API always re-derives
 * authorization from requireProjectAccess.
 */
export async function resolveAuthorizedWorkspace(
  userId: string,
): Promise<ControlledWorkspace | undefined> {
  const [row] = await db
    .select({
      organizationId: projects.organizationId,
      projectId: projects.id,
      profileId: emotionalProfiles.id,
    })
    .from(organizationMembers)
    .innerJoin(
      projects,
      eq(projects.organizationId, organizationMembers.organizationId),
    )
    .innerJoin(emotionalProfiles, eq(emotionalProfiles.projectId, projects.id))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(projects.createdAt, emotionalProfiles.createdAt)
    .limit(1);
  return row;
}
