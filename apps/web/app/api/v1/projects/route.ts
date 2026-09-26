import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthenticationError, requireAuth } from '@emora/auth';

import {
  ProfileError,
  toErrorEnvelope,
} from '../../../../server/profiles/errors';
import { listAuthorizedProjects } from '../../../../server/profiles/service';

// Node.js runtime (default): PostgreSQL and Better Auth sessions are required.
export const dynamic = 'force-dynamic';

/**
 * Allow-listed structured log fields only — same discipline as Slice 1's
 * logging.ts. Project names, slugs, payloads, and secrets have no path here.
 */
interface ProjectDiscoveryLogFields {
  readonly level: 'info' | 'error';
  readonly event: 'project_discovery';
  readonly requestId: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly errorCategory?: string;
  readonly userId?: string;
  readonly projectCount?: number;
}

function logProjectDiscovery(fields: ProjectDiscoveryLogFields): void {
  const line = JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ),
  );
  console.log(line);
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  let userId: string | undefined;
  let projectCount: number | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logProjectDiscovery({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'project_discovery',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(projectCount === undefined ? {} : { projectCount }),
    });
  };

  try {
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

    // 2. Membership-scoped discovery. Authorization is server-derived from
    //    organization membership; the client never supplies an organization.
    const result = await listAuthorizedProjects({ userId, requestId });
    projectCount = result.body.projects.length;

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