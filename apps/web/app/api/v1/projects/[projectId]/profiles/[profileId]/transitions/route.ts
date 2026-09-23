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
  TransitionError,
  toErrorEnvelope,
} from '../../../../../../../../server/transitions/errors';
import { logTransition } from '../../../../../../../../server/transitions/logging';
import { runProjectScopedTransition } from '../../../../../../../../server/transitions/service';
import {
  parseIdempotencyKey,
  parseTransitionRequest,
} from '../../../../../../../../server/transitions/validation';

// Node.js runtime (default): PostgreSQL, node:crypto, and Better Auth sessions
// are all required. No edge runtime.
export const dynamic = 'force-dynamic';

const paramsSchema = z.strictObject({
  projectId: z.uuid(),
  profileId: z.uuid(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  let organizationId: string | undefined;
  let projectId: string | undefined;
  let profileId: string | undefined;
  let eventId: string | undefined;
  let stateId: string | undefined;
  let userId: string | undefined;
  let duplicate: boolean | undefined;
  let modelId: string | undefined;
  let modelVersion: string | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logTransition({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'emotional_transition',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(organizationId === undefined ? {} : { organizationId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(profileId === undefined ? {} : { profileId }),
      ...(eventId === undefined ? {} : { eventId }),
      ...(stateId === undefined ? {} : { stateId }),
      ...(modelId === undefined ? {} : { modelId }),
      ...(modelVersion === undefined ? {} : { modelVersion }),
      ...(duplicate === undefined ? {} : { duplicate }),
    });
  };

  try {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) throw new TransitionError('invalid_input');
    projectId = params.data.projectId;
    profileId = params.data.profileId;

    // 1. Authentication.
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new TransitionError('unauthenticated');
      }
      throw new TransitionError('internal_error');
    }
    userId = session.user.id;

    // 2. Project authorization (organization identity comes from the project row).
    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'MEMBER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new TransitionError('forbidden');
      }
      throw new TransitionError('internal_error');
    }
    organizationId = project.organizationId;

    // 3. Mandatory idempotency key.
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get('idempotency-key'),
    );

    // 4. Content type.
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new TransitionError('invalid_content_type');
    }

    // 5. Strict body validation.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new TransitionError('invalid_input');
    }
    const acceptedRequest = parseTransitionRequest(rawBody);

    const result = await runProjectScopedTransition({
      userId,
      organizationId,
      projectId,
      profileId,
      idempotencyKey,
      request: acceptedRequest,
      requestId,
      now: new Date(),
    });

    eventId = result.eventId;
    stateId = result.stateId;
    duplicate = result.body.duplicate;
    modelId = result.body.modelIdentity.providerIdentifier;
    modelVersion = result.body.modelIdentity.version;
    finish(result.body.duplicate ? 'duplicate_replayed' : 'created');

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const transitionError =
      error instanceof TransitionError
        ? error
        : new TransitionError('internal_error');
    finish(
      transitionError.code === 'internal_error' ? 'failed' : 'rejected',
      transitionError.errorCategory,
    );
    return NextResponse.json(toErrorEnvelope(transitionError, requestId), {
      status: transitionError.status,
    });
  }
}
