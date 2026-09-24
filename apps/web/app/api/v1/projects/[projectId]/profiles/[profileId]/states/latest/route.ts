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
  StateReadError,
  toErrorEnvelope,
} from '../../../../../../../../../server/states/errors';
import { readLatestState } from '../../../../../../../../../server/states/service';

// Node.js runtime (default): PostgreSQL, node:crypto, and Better Auth sessions
// are all required. No edge runtime.
export const dynamic = 'force-dynamic';

const paramsSchema = z.strictObject({
  projectId: z.uuid(),
  profileId: z.uuid(),
});

/**
 * Allow-listed structured log fields only — same discipline as Slice 1's
 * logging.ts. Emotion values, dimensions, confidence, raw JSONB, context,
 * payloads, and secrets have no path into this line.
 */
interface StateReadLogFields {
  readonly level: 'info' | 'error';
  readonly event: 'emotional_state_read';
  readonly requestId: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly errorCategory?: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly projectId?: string;
  readonly profileId?: string;
  readonly stateId?: string;
}

function logStateRead(fields: StateReadLogFields): void {
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
  let profileId: string | undefined;
  let userId: string | undefined;
  let stateId: string | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logStateRead({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'emotional_state_read',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(organizationId === undefined ? {} : { organizationId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(profileId === undefined ? {} : { profileId }),
      ...(stateId === undefined ? {} : { stateId }),
    });
  };

  try {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) throw new StateReadError('invalid_input');
    projectId = params.data.projectId;
    profileId = params.data.profileId;

    // 1. Authentication.
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new StateReadError('unauthenticated');
      }
      throw new StateReadError('internal_error');
    }
    userId = session.user.id;

    // 2. Project authorization at the VIEWER read floor. Organization identity
    //    is derived server-side from the project row — never from the request.
    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'VIEWER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new StateReadError('forbidden');
      }
      throw new StateReadError('internal_error');
    }
    organizationId = project.organizationId;

    // 3. Read the latest persisted computational state. The service owns the
    //    successful-read audit; failure paths create no audit rows.
    const result = await readLatestState({
      userId,
      organizationId,
      projectId,
      profileId,
      requestId,
    });
    stateId = result.body.stateId;

    finish('succeeded');
    return NextResponse.json(result.body, { status: 200 });
  } catch (error) {
    const readError =
      error instanceof StateReadError
        ? error
        : new StateReadError('internal_error');
    finish(
      readError.code === 'internal_error' ? 'failed' : 'rejected',
      readError.errorCategory,
    );
    return NextResponse.json(toErrorEnvelope(readError, requestId), {
      status: readError.status,
    });
  }
}
