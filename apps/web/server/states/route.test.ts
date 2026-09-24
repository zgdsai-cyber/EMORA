import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../transitions/disclosure';

/**
 * Route-level tests for the frozen Slice 2 read surface: path validation,
 * authentication, VIEWER authorization, exact response contract, disclosure
 * byte-identity, error envelope mapping, and structured log minimization.
 * The service layer — which owns the successful-read audit — is mocked here;
 * the real persistence and audit path is covered by
 * service.integration.test.ts (mirroring Slice 1's split).
 */

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
  readLatestState: vi.fn(),
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
  readLatestState: mocks.readLatestState,
}));

const { GET } = await import(
  '../../app/api/v1/projects/[projectId]/profiles/[profileId]/states/latest/route'
);

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';
const STATE_ID = '66666666-6666-4666-8666-666666666666';

function successBody() {
  return {
    requestId: 'request-id',
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    stateId: STATE_ID,
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
    disclosure: SCIENTIFIC_DISCLOSURE_CODE,
    disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
  };
}

const context = (params: Record<string, string> = {}) => ({
  params: Promise.resolve({
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    ...params,
  }),
});

async function invoke(
  params?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const request = { headers: new Headers() } as unknown as NextRequest;
  const response = await GET(request, context(params) as never);
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
    membership: { role: 'VIEWER' },
  });
  mocks.readLatestState.mockResolvedValue({
    status: 200,
    body: successBody(),
  });
});

describe('Slice 2 latest-state read route', () => {
  it('rejects malformed path parameters before authentication', async () => {
    const { status, body } = await invoke({ projectId: 'not-a-uuid' });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.requireAuth).not.toHaveBeenCalled();
    expect(mocks.readLatestState).not.toHaveBeenCalled();
  });

  it('returns 401 for an unauthenticated request without invoking the audited service', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status, body } = await invoke();
    expect(status).toBe(401);
    expect((body.error as Record<string, unknown>).code).toBe(
      'unauthenticated',
    );
    // The service owns the successful-read audit; never reaching it means no
    // audit row can be created for an unauthenticated request.
    expect(mocks.readLatestState).not.toHaveBeenCalled();
    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('rejected');
    expect(line.errorCategory).toBe('unauthenticated');
  });

  it('returns 403 when the caller has no project access, without audit', async () => {
    mocks.requireProjectAccess.mockRejectedValue(
      new mocks.AuthorizationError(),
    );
    const { status, body } = await invoke();
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe('forbidden');
    expect(mocks.readLatestState).not.toHaveBeenCalled();
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('rejected');
    expect(line.errorCategory).toBe('forbidden');
  });

  it('authorizes reads at the VIEWER floor and passes server-derived identifiers', async () => {
    const { status } = await invoke();
    expect(status).toBe(200);
    // VIEWER is the minimum read role: VIEWER, MEMBER, ADMIN, and OWNER all
    // satisfy requireProjectAccess(..., 'VIEWER'); role ranking itself is
    // covered by packages/auth/src/authorization.test.ts.
    expect(mocks.requireProjectAccess).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      'VIEWER',
    );
    const argument = mocks.readLatestState.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(argument.organizationId).toBe(ORGANIZATION_ID);
    expect(argument.projectId).toBe(PROJECT_ID);
    expect(argument.profileId).toBe(PROFILE_ID);
    expect(argument.userId).toBe(USER_ID);
    expect(typeof argument.requestId).toBe('string');
  });

  it('returns the exact frozen response contract with byte-identical disclosure', async () => {
    const { status, body } = await invoke();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      [
        'disclosure',
        'disclosureText',
        'dimensions',
        'emotionVector',
        'initialized',
        'modelIdentity',
        'parameterIdentity',
        'profileId',
        'projectId',
        'requestId',
        'stateId',
        'timestamp',
      ].sort(),
    );
    expect(body.disclosure).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(body.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
    expect(Object.keys(body.dimensions as object).sort()).toEqual([
      'arousal',
      'intensity',
      'valence',
    ]);
    expect(Object.keys(body.emotionVector as object)).toEqual([
      'love',
      'fear',
      'nostalgia',
      'jealousy',
      'trust',
      'anger',
      'joy',
    ]);
    expect(body).toHaveProperty('modelIdentity');
    expect(body).toHaveProperty('parameterIdentity');
  });

  it('never exposes confidence, adjustment, or prohibited fields', async () => {
    const { body } = await invoke();
    expect(body).not.toHaveProperty('confidence');
    expect(body).not.toHaveProperty('confidenceAdjustment');
    const { disclosureText: _disclosure, ...withoutDisclosure } = body;
    const serialized = JSON.stringify(withoutDisclosure);
    for (const forbidden of [
      'confidence',
      'explanationMetadata',
      'dominant',
      'ranking',
      'winner',
      'threshold',
      'score',
      'superiority',
      'context',
      'memories',
      'embedding',
      'duplicate',
      'eventId',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(_disclosure).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
  });

  it('maps state_not_found to a safe 404 without invoking audit infrastructure', async () => {
    const { StateReadError } = await import('./errors');
    mocks.readLatestState.mockRejectedValue(
      new StateReadError('state_not_found'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(404);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('state_not_found');
    expect(error.message).toBe(
      'The requested emotional state is not available.',
    );
    expect(typeof error.requestId).toBe('string');
    expect(JSON.stringify(body)).not.toContain('SELECT');
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('rejected');
    expect(line.errorCategory).toBe('state_not_found');
  });

  it('maps corrupted persisted state to state_data_invalid without leaking contents', async () => {
    const { StateReadError } = await import('./errors');
    mocks.readLatestState.mockRejectedValue(
      new StateReadError('state_data_invalid', 'state_integrity'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('state_data_invalid');
    expect(error.message).toBe(
      'The stored emotional state is not valid. The state was not returned.',
    );
    expect(JSON.stringify(body)).not.toContain('state_integrity');
    expect(JSON.stringify(body)).not.toContain('emotionVector');
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('rejected');
    expect(line.errorCategory).toBe('state_integrity');
  });

  it('fails closed with a safe envelope when the successful-read audit fails', async () => {
    const { StateReadError } = await import('./errors');
    mocks.readLatestState.mockRejectedValue(
      new StateReadError('internal_error', 'read_audit_failed'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('internal_error');
    expect(error.message).toBe('The state could not be read.');
    // The operational category never reaches the client.
    expect(JSON.stringify(body)).not.toContain('read_audit_failed');
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('failed');
    expect(line.errorCategory).toBe('read_audit_failed');
  });

  it('fails closed with internal_error for an unexpected failure', async () => {
    mocks.readLatestState.mockRejectedValue(
      new Error('raw database failure: select from emotional_states'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('emotional_states');
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('failed');
  });

  it('emits only allow-listed fields in the structured log on success', async () => {
    await invoke();
    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(
      [
        'event',
        'latencyMs',
        'level',
        'organizationId',
        'outcome',
        'projectId',
        'profileId',
        'requestId',
        'stateId',
        'userId',
      ].sort(),
    );
    expect(line.event).toBe('emotional_state_read');
    expect(line.outcome).toBe('succeeded');
    for (const forbidden of [
      'confidence',
      'valence',
      'arousal',
      'intensity',
      'emotionVector',
      'context',
      'stack',
      'password',
      'token',
    ]) {
      expect(logged[0]).not.toContain(forbidden);
    }
  });
});


afterEach(() => {
  vi.restoreAllMocks();
});
