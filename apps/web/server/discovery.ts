import { AuthorizationError, requireProjectAccess } from '@emora/auth';

import {
  listAuthorizedProjects,
  listProjectProfiles,
  type ProjectListItem,
  type ProfileListItem,
} from './profiles/service';

/**
 * Slice 3 production workspace discovery — the real membership-scoped source of
 * project/profile identity for the application. This replaces the fixture
 * module as the production workspace resolver; the controlled fixture remains
 * development/test-only (see apps/web/server/transitions/fixture.ts).
 *
 * Discovery is read-only and never authorizes anything by itself: project
 * access is re-derived server-side through requireProjectAccess, and the API
 * routes re-check independently.
 */

export type WorkspaceProject = ProjectListItem;
export interface Workspace {
  readonly project: WorkspaceProject;
  readonly profiles: readonly ProfileListItem[];
}

/** All projects the user may use, ordered `createdAt ASC, id ASC`. */
export async function discoverAuthorizedProjects(
  userId: string,
): Promise<readonly WorkspaceProject[]> {
  const result = await listAuthorizedProjects({
    userId,
    requestId: crypto.randomUUID(),
  });
  return result.body.projects;
}

/**
 * Profiles of one project, ordered `createdAt ASC, id ASC`. Returns an empty
 * list when the user may not access the project (the UI shows its controlled
 * empty state) — never an existence oracle. Throws only on infrastructure
 * failure.
 */
export async function discoverAuthorizedProfiles(
  userId: string,
  projectId: string,
): Promise<readonly ProfileListItem[]> {
  try {
    await requireProjectAccess(userId, projectId, 'VIEWER');
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    throw error;
  }
  const result = await listProjectProfiles({
    projectId,
    requestId: crypto.randomUUID(),
  });
  return result.body.profiles;
}