import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { SCIENTIFIC_DISCLOSURE_TEXT } from './disclosure';

/**
 * Route-level tests for the frozen Slice 1 transport surface: authentication,
 * authorization, mandatory idempotency key, strict validation, error taxonomy,
 * and log data minimization. The service layer is mocked here; the real
 * service/database path is covered by service.integration.test.ts.
 */

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
  runTransition: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock('@emora/auth', () => ({
  requireAuth: mocks.requireAuth,
  requireProjectAccess: mocks.requireProjectAccess,
  AuthenticationError: mocks.AuthenticationError,
  AuthorizationError: mocks.AuthorizationError,
}));

vi.mock('./service', () => ({
  runProjectScopedTransition: mocks.runTransition,
  requestDigest: () => 'digest',
}));

const { POST } =
  await import('../../app/api/v1/projects/[projectId]/profiles/[profileId]/transitions/route');

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = 'idem-key-12345678';

const VALID_BODY = {
  valence: 0.5,
  intensity: 0.5,
  relevance: 0.5,
  surprise: 0.5,
  uncertainty: 0.5,
};

function makeRequest(options: {
  headers?: Record<string, string>;
  body?: unknown;
  rawJson?: () => Promise<unknown>;
}): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'idempotency-key': IDEMPOTENCY_KEY,
    ...options.headers,
  });
  return {
    headers,
    json:
      options.rawJson ??
      (async () => {
        if (options.body === undefined) throw new SyntaxError('no body');
        return options.body;
      }),
  } as unknown as NextRequest;
}

const context = (params: Record<string, string> = {}) => ({
  params: Promise.resolve({
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    ...params,
  }),
});

function successBody() {
  return {
    requestId: 'request-id',
    duplicate: false,
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    eventId: '55555555-5555-4555-8555-555555555555',
    stateId: '66666666-6666-4666-8666-666666666666',
    timestamp: '2026-09-22T10:00:00.000Z',
    emotionVector: {
      love: 0.1,
      fear: 0.2,
      nostalgia: 0.3,
      jealousy: 0.4,
      trust: 0.5,
      anger: 0.6,
      joy: 0.7,
    },
    dimensions: { valence: 0.1, arousal: 0.2, intensity: 0.3 },
    modelIdentity: {
      modelVersionId: '77777777-7777-4777-8777-777777777777',
      name: 'emora-deterministic-dynamics',
      version: '1.0.0',
      providerIdentifier: 'deterministic-emotional-dynamics',
      providerVersion: '1.0.0',
    },
    parameterIdentity: 'DEFAULT_DETERMINISTIC_MODEL_PARAMETERS',
    initialized: true,
    disclosure: 'COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT',
    disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
  };
}

async function invoke(
  request: NextRequest,
  params?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await POST(request, context(params) as never);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
  mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID } });
  mocks.requireProjectAccess.mockResolvedValue({
    project: { id: PROJECT_ID, organizationId: ORGANIZATION_ID },
    membership: { role: 'MEMBER' },
  });
  mocks.runTransition.mockResolvedValue({
    status: 201,
    eventId: '55555555-5555-4555-8555-555555555555',
    stateId: '66666666-6666-4666-8666-666666666666',
    body: successBody(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
describe('Slice 1 transition route', () => {
  it('returns 401 for an unauthenticated request', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status, body } = await invoke(makeRequest({ body: VALID_BODY }));
    expect(status).toBe(401);
    expect((body.error as Record<string, unknown>).code).toBe(
      'unauthenticated',
    );
    expect(mocks.runTransition).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not a project member', async () => {
    mocks.requireProjectAccess.mockRejectedValue(
      new mocks.AuthorizationError(),
    );
    const { status, body } = await invoke(makeRequest({ body: VALID_BODY }));
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe('forbidden');
    expect(mocks.runTransition).not.toHaveBeenCalled();
  });

  it('rejects malformed path parameters before authentication', async () => {
    const { status, body } = await invoke(makeRequest({ body: VALID_BODY }), {
      projectId: 'not-a-uuid',
    });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.requireAuth).not.toHaveBeenCalled();
  });

  it('requires the Idempotency-Key header', async () => {
    for (const value of ['', 'short', 'a'.repeat(129)]) {
      const request = makeRequest({ body: VALID_BODY });
      request.headers.set('idempotency-key', value);
      const { status, body } = await invoke(request);
      expect(status).toBe(400);
      expect((body.error as Record<string, unknown>).code).toBe(
        'idempotency_key_required',
      );
    }
    const missing = makeRequest({ body: VALID_BODY });
    missing.headers.delete('idempotency-key');
    expect((await invoke(missing)).status).toBe(400);
    expect(mocks.runTransition).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON content type', async () => {
    const { status, body } = await invoke(
      makeRequest({
        body: VALID_BODY,
        headers: { 'content-type': 'text/plain' },
      }),
    );
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe(
      'invalid_content_type',
    );
    expect(mocks.runTransition).not.toHaveBeenCalled();
  });

  it('rejects malformed and invalid bodies with 400', async () => {
    const cases: Array<unknown | (() => Promise<unknown>)> = [
      { ...VALID_BODY, unknownField: 1 },
      { ...VALID_BODY, confidence: 0.9 },
      { ...VALID_BODY, valence: 2 },
      { ...VALID_BODY, intensity: -1 },
      { ...VALID_BODY, surprise: 'high' },
      { ...VALID_BODY, uncertainty: null },
      { ...VALID_BODY, context: [1, 2, 3] },
      { ...VALID_BODY, context: { text: 'x'.repeat(9000) } },
      {},
      null,
      () => Promise.reject(new SyntaxError('invalid json')),
    ];
    for (const body of cases) {
      const request =
        typeof body === 'function'
          ? makeRequest({ rawJson: body as () => Promise<unknown> })
          : makeRequest({ body });
      const { status, body: responseBody } = await invoke(request);
      expect(status).toBe(400);
      expect((responseBody.error as Record<string, unknown>).code).toBe(
        'invalid_input',
      );
    }
    expect(mocks.runTransition).not.toHaveBeenCalled();
  });
  it('never logs raw context content', async () => {
    const marker = 'do-not-log-this-context-value-9f2c';
    const { status } = await invoke(
      makeRequest({
        body: {
          ...VALID_BODY,
          context: { note: marker, nested: { deep: marker } },
        },
      }),
    );
    expect(status).toBe(201);
    // The context was accepted and passed to the service...
    const argument = mocks.runTransition.mock.calls[0][0] as {
      request: { context?: unknown };
    };
    expect(JSON.stringify(argument.request.context)).toContain(marker);
    // ...but no log line may contain it, nor any context key.
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain(marker);
    expect(logged[0]).not.toContain('context');
    expect(logged[0]).not.toContain('note');
  });

  it('returns 201 with the service body on success and logs only safe fields', async () => {
    const { status, body } = await invoke(makeRequest({ body: VALID_BODY }));
    expect(status).toBe(201);
    expect(body).toEqual(successBody());

    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    const allowed = [
      'level',
      'event',
      'requestId',
      'outcome',
      'latencyMs',
      'errorCategory',
      'userId',
      'organizationId',
      'projectId',
      'profileId',
      'eventId',
      'stateId',
      'modelId',
      'modelVersion',
      'duplicate',
    ];
    for (const key of Object.keys(line)) {
      expect(allowed).toContain(key);
    }
    for (const forbidden of [
      'emotionVector',
      'valence',
      'arousal',
      'intensity',
      'confidence',
      'context',
      'requestHash',
      'disclosure',
    ]) {
      expect(logged[0]).not.toContain(forbidden);
    }
    expect(line.outcome).toBe('created');
    expect(line.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps a replayed result to 200 with duplicate true', async () => {
    mocks.runTransition.mockResolvedValue({
      status: 200,
      eventId: '55555555-5555-4555-8555-555555555555',
      stateId: '66666666-6666-4666-8666-666666666666',
      body: { ...successBody(), duplicate: true },
    });
    const { status, body } = await invoke(makeRequest({ body: VALID_BODY }));
    expect(status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body).not.toHaveProperty('confidence');
    expect(body).not.toHaveProperty('confidenceAdjustment');
    expect(JSON.stringify(body)).not.toContain('confidence');
  });

  it('exposes no confidence or confidence-like field in any response', async () => {
    const { body } = await invoke(makeRequest({ body: VALID_BODY }));
    expect(Object.keys(body.dimensions as object).sort()).toEqual([
      'arousal',
      'intensity',
      'valence',
    ]);
    expect(body).not.toHaveProperty('confidence');
    expect(body).not.toHaveProperty('confidenceAdjustment');
    expect(JSON.stringify(body)).not.toContain('confidence');
    expect(JSON.stringify(body)).not.toContain('confidenceAdjustment');
  });

  it('maps governed failures without leaking internals', async () => {
    const { TransitionError } = await import('./errors');
    const cases = [
      ['profile_data_invalid', 500],
      ['idempotency_conflict', 409],
      ['temporal_conflict', 409],
      ['profile_not_found', 404],
      ['concurrency_conflict', 409],
      ['internal_error', 500],
    ] as const;

    for (const [code, expectedStatus] of cases) {
      mocks.runTransition.mockRejectedValue(
        new TransitionError(code, `${code}_internal_category`),
      );
      const { status, body } = await invoke(makeRequest({ body: VALID_BODY }));
      expect(status).toBe(expectedStatus);
      const error = body.error as Record<string, unknown>;
      expect(error.code).toBe(code);
      expect(typeof error.requestId).toBe('string');
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('_internal_category');
      expect(serialized).not.toContain('stack');
      expect(serialized).not.toContain('insert into');
    }
  });

  it('fails closed with internal_error for an unexpected failure', async () => {
    mocks.runTransition.mockRejectedValue(
      new Error('raw database failure: insert into emotional_events'),
    );
    const { status, body } = await invoke(makeRequest({ body: VALID_BODY }));
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('emotional_events');
    expect(logged).toHaveLength(1);
    expect((JSON.parse(logged[0]) as Record<string, unknown>).outcome).toBe(
      'failed',
    );
  });

  it('rejects a caller-supplied organization id', async () => {
    const { status } = await invoke(
      makeRequest({
        body: { ...VALID_BODY, organizationId: ORGANIZATION_ID },
      }),
    );
    expect(status).toBe(400);
    expect(mocks.runTransition).not.toHaveBeenCalled();
  });

  it('passes the server-derived organization and identifiers to the service', async () => {
    await invoke(makeRequest({ body: VALID_BODY }));
    expect(mocks.runTransition).toHaveBeenCalledTimes(1);
    const argument = mocks.runTransition.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(argument.organizationId).toBe(ORGANIZATION_ID);
    expect(argument.projectId).toBe(PROJECT_ID);
    expect(argument.profileId).toBe(PROFILE_ID);
    expect(argument.userId).toBe(USER_ID);
    expect(argument.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(argument.request).toEqual(VALID_BODY);
    expect(mocks.requireProjectAccess).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      'MEMBER',
    );
  });
});
