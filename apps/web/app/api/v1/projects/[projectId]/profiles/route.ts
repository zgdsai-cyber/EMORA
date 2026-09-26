import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  AuthenticationError,
  AuthorizationError,
  requireAuth,
  requireProjectAccess,
} from '@emora/auth';
import { z } from 'zod';

import {
  ProfileError,
  toErrorEnvelope,
} from '../../../../../../server/profiles/errors';
import {
  createProjectProfile,
  listProjectProfiles,
} from '../../../../../../server/profiles/service';
import { parseCreateProfileRequest } from '../../../../../../server/profiles/validation';

// Node.js runtime (default): PostgreSQL, node:crypto, and Better Auth sessions
// are all required. No edge runtime.
export const dynamic = 'force-dynamic';

const paramsSchema = z.strictObject({
  projectId: z.uuid(),
});

/**
 * Allow-listed structured log fields only. externalReference, profileData,
 * personality values, additionalTraits, payloads, and secrets have no path
 * into these lines.
 */
interface ProfileLogFields {
  readonly level: 'info' | 'error';
  readonly event: 'profile_discovery' | 'profile_create';
  readonly requestId: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly errorCategory?: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly projectId?: string;
  readonly profileId?: string;
  readonly profileCount?: number;
}

function logProfile(fields: ProfileLogFields): void {
  const line = JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ),
  );
  console.log(line);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  let organizationId: string | undefined;
  let projectId: string | undefined;
  let userId: string | undefined;
  let profileCount: number | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logProfile({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'profile_discovery',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(organizationId === undefined ? {} : { organizationId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(profileCount === undefined ? {} : { profileCount }),
    });
  };

  try {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) throw new ProfileError('invalid_input');
    projectId = params.data.projectId;

    // 1. Authentication.
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new ProfileError('unauthenticated');
      }
      throw new ProfileError('internal_error');
    }
    userId = session.user.id;

    // 2. Project authorization at the VIEWER read floor. Unknown and
    //    unauthorized projects are indistinguishable (no existence oracle).
    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'VIEWER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new ProfileError('forbidden');
      }
      throw new ProfileError('internal_error');
    }
    organizationId = project.organizationId;

    // 3. Complete, project-constrained profile list (no pagination).
    const result = await listProjectProfiles({ projectId, requestId });
    profileCount = result.body.profiles.length;

    finish('succeeded');
    return NextResponse.json(result.body, { status: 200 });
  } catch (error) {
    const profileError =
      error instanceof ProfileError
        ? error
        : new ProfileError('internal_error');
    finish(
      profileError.code === 'internal_error' ? 'failed' : 'rejected',
      profileError.errorCategory,
    );
    return NextResponse.json(toErrorEnvelope(profileError, requestId), {
      status: profileError.status,
    });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  let organizationId: string | undefined;
  let projectId: string | undefined;
  let userId: string | undefined;
  let profileId: string | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logProfile({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'profile_create',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(organizationId === undefined ? {} : { organizationId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(profileId === undefined ? {} : { profileId }),
    });
  };

  try {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) throw new ProfileError('invalid_input');
    projectId = params.data.projectId;

    // 1. Authentication.
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new ProfileError('unauthenticated');
      }
      throw new ProfileError('internal_error');
    }
    userId = session.user.id;

    // 2. Project authorization at the MEMBER write floor. Unknown and
    //    unauthorized projects are indistinguishable (no existence oracle).
    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'MEMBER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new ProfileError('forbidden');
      }
      throw new ProfileError('internal_error');
    }
    organizationId = project.organizationId;

    // 3. Content type.
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new ProfileError('invalid_content_type');
    }

    // 4. Strict body validation (unknown fields rejected; invalid input writes
    //    nothing and audits nothing).
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ProfileError('invalid_input');
    }
    const acceptedRequest = parseCreateProfileRequest(rawBody);

    // 5. Atomic creation: profile row and its single success audit row in one
    //    transaction (duplicate externalReference => 409, no audit row).
    const result = await createProjectProfile({
      userId,
      organizationId,
      projectId,
      requestId,
      request: acceptedRequest,
    });
    profileId = result.profileId;

    finish('created');
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const profileError =
      error instanceof ProfileError
        ? error
        : new ProfileError('internal_error');
    finish(
      profileError.code === 'internal_error' ? 'failed' : 'rejected',
      profileError.errorCategory,
    );
    return NextResponse.json(toErrorEnvelope(profileError, requestId), {
      status: profileError.status,
    });
  }
}