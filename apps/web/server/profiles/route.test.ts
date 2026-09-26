import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { ProfileError } from './errors';

/**
 * Route-level tests for the frozen Slice 3 surfaces: path validation,
 * authentication, VIEWER/MEMBER authorization floors, exact response shapes,
 * duplicate 409 behavior, error envelope mapping, and structured log
 * minimization. The service layer — which owns atomic create+audit — is mocked
 * here; the real persistence and audit path is covered by
 * service.integration.test.ts (mirroring Slice 1/2's split).
 */

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
  listAuthorizedProjects: vi.fn(),
  listProjectProfiles: vi.fn(),
  createProjectProfile: vi.fn(),
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
  listAuthorizedProjects: mocks.listAuthorizedProjects,
  listProjectProfiles: mocks.listProjectProfiles,
  createProjectProfile: mocks.createProjectProfile,
}));

const { GET: GET_PROJECTS } = await import(
  '../../app/api/v1/projects/route'
);
const { GET: GET_PROFILES, POST: POST_PROFILE } = await import(
  '../../app/api/v1/projects/[projectId]/profiles/route'
);

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';

const VALID_BODY = {
  externalReference: 'slice3-profile-1',
  personalityProfile: {
    emotionalSensitivity: 0.5,
    baselineTrust: 0.5,
    baselineAnxiety: 0.5,
    attachmentSensitivity: 0.5,
    nostalgiaSensitivity: 0.5,
    jealousySensitivity: 0.5,
  },
};

const context = (params: Record<string, string> = {}) => ({
  params: Promise.resolve({ projectId: PROJECT_ID, ...params }),
});

async function invokeProjects(): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const request = { headers: new Headers() } as unknown as NextRequest;
  const response = await GET_PROJECTS(request);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function invokeProfiles(
  params?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const request = { headers: new Headers() } as unknown as NextRequest;
  const response = await GET_PROFILES(request, context(params) as never);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function invokeCreate(
  options: {
    body?: unknown;
    contentType?: string | null;
    malformedJson?: boolean;
    params?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set('content-type', options.contentType ?? 'application/json');
  }
  const request = {
    headers,
    json: options.malformedJson
      ? async () => {
          throw new SyntaxError('Unexpected token');
        }
      : async () => options.body,
  } as unknown as NextRequest;
  const response = await POST_PROFILE(request, context(options.params) as never);
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
  mocks.listAuthorizedProjects.mockResolvedValue({
    status: 200,
    body: {
      requestId: 'request-id',
      projects: [
        {
          projectId: PROJECT_ID,
          name: 'Project One',
          slug: 'project-one',
          createdAt: '2026-09-25T10:00:00.000Z',
        },
      ],
    },
  });
  mocks.listProjectProfiles.mockResolvedValue({
    status: 200,
    body: {
      requestId: 'request-id',
      profiles: [
        {
          profileId: PROFILE_ID,
          externalReference: 'slice3-profile-1',
          createdAt: '2026-09-25T10:01:00.000Z',
        },
      ],
    },
  });
  mocks.createProjectProfile.mockResolvedValue({
    status: 201,
    body: {
      requestId: 'request-id',
      projectId: PROJECT_ID,
      profileId: PROFILE_ID,
      externalReference: 'slice3-profile-1',
      createdAt: '2026-09-25T10:01:00.000Z',
    },
    profileId: PROFILE_ID,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Slice 3 project discovery route', () => {
  it('returns 401 for an unauthenticated request without invoking the service', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status, body } = await invokeProjects();
    expect(status).toBe(401);
    expect((body.error as Record<string, unknown>).code).toBe(
      'unauthenticated',
    );
    expect(mocks.listAuthorizedProjects).not.toHaveBeenCalled();
  });

  it('returns the exact membership-scoped list shape', async () => {
    const { status, body } = await invokeProjects();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['projects', 'requestId']);
    expect(body.projects).toEqual([
      {
        projectId: PROJECT_ID,
        name: 'Project One',
        slug: 'project-one',
        createdAt: '2026-09-25T10:00:00.000Z',
      },
    ]);
    expect(mocks.listAuthorizedProjects).toHaveBeenCalledWith({
      userId: USER_ID,
      requestId: expect.any(String),
    });
  });

  it('returns an empty array (200) when nothing is authorized', async () => {
    mocks.listAuthorizedProjects.mockResolvedValue({
      status: 200,
      body: { requestId: 'request-id', projects: [] },
    });
    const { status, body } = await invokeProjects();
    expect(status).toBe(200);
    expect(body.projects).toEqual([]);
  });

  it('maps unexpected failures to internal_error without leaking details', async () => {
    mocks.listAuthorizedProjects.mockRejectedValue(
      new Error('connection refused: postgres://secret'),
    );
    const { status, body } = await invokeProjects();
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('internal_error');
    expect(error.message).toBe('The request could not be completed.');
    expect(JSON.stringify(body)).not.toContain('postgres://secret');
  });
});

describe('Slice 3 profile list route', () => {
  it('rejects malformed path parameters before authentication', async () => {
    const { status, body } = await invokeProfiles({ projectId: 'not-a-uuid' });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.requireAuth).not.toHaveBeenCalled();
    expect(mocks.listProjectProfiles).not.toHaveBeenCalled();
  });

  it('returns 401 unauthenticated without invoking the service', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status } = await invokeProfiles();
    expect(status).toBe(401);
    expect(mocks.listProjectProfiles).not.toHaveBeenCalled();
  });

  it('returns 403 for a project the user cannot access (no existence oracle)', async () => {
    mocks.requireProjectAccess.mockRejectedValue(
      new mocks.AuthorizationError(),
    );
    const { status, body } = await invokeProfiles();
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe('forbidden');
    expect(mocks.listProjectProfiles).not.toHaveBeenCalled();
    expect(mocks.requireProjectAccess).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      'VIEWER',
    );
  });

  it('returns the exact profile list shape', async () => {
    const { status, body } = await invokeProfiles();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['profiles', 'requestId']);
    expect(body.profiles).toEqual([
      {
        profileId: PROFILE_ID,
        externalReference: 'slice3-profile-1',
        createdAt: '2026-09-25T10:01:00.000Z',
      },
    ]);
    expect(mocks.listProjectProfiles).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      requestId: expect.any(String),
    });
  });

  it('returns an empty array (200) when the project has no profiles', async () => {
    mocks.listProjectProfiles.mockResolvedValue({
      status: 200,
      body: { requestId: 'request-id', profiles: [] },
    });
    const { status, body } = await invokeProfiles();
    expect(status).toBe(200);
    expect(body.profiles).toEqual([]);
  });
});

describe('Slice 3 profile create route', () => {
  it('enforces the MEMBER write floor and creates successfully', async () => {
    const { status } = await invokeCreate({ body: VALID_BODY });
    expect(status).toBe(201);
    expect(mocks.requireProjectAccess).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      'MEMBER',
    );
  });

  it('returns 403 when authorization fails, without invoking the service', async () => {
    mocks.requireProjectAccess.mockRejectedValue(new mocks.AuthorizationError());
    const { status, body } = await invokeCreate({ body: VALID_BODY });
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe('forbidden');
    expect(mocks.createProjectProfile).not.toHaveBeenCalled();
  });

  it('returns 401 unauthenticated', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status } = await invokeCreate({ body: VALID_BODY });
    expect(status).toBe(401);
    expect(mocks.createProjectProfile).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON content type with invalid_content_type', async () => {
    const { status, body } = await invokeCreate({
      body: VALID_BODY,
      contentType: 'text/plain',
    });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe(
      'invalid_content_type',
    );
    expect(mocks.createProjectProfile).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with invalid_input', async () => {
    const { status, body } = await invokeCreate({ malformedJson: true });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.createProjectProfile).not.toHaveBeenCalled();
  });

  it('rejects unknown fields and invalid parameters without writes', async () => {
    for (const body of [
      { ...VALID_BODY, extra: 1 },
      { ...VALID_BODY, name: 'x' },
      { ...VALID_BODY, externalReference: 'x'.repeat(129) },
      { ...VALID_BODY, externalReference: 42 },
      {
        ...VALID_BODY,
        personalityProfile: {
          ...VALID_BODY.personalityProfile,
          emotionalSensitivity: 1.5,
        },
      },
      {
        ...VALID_BODY,
        personalityProfile: {
          ...VALID_BODY.personalityProfile,
          baselineTrust: Number.NaN,
        },
      },
      {
        ...VALID_BODY,
        personalityProfile: {
          ...VALID_BODY.personalityProfile,
          openness: 0.5,
        },
      },
      { ...VALID_BODY, additionalTraits: { key: 2 } },
      { ...VALID_BODY, additionalTraits: 'x' },
    ]) {
      const { status, body: responseBody } = await invokeCreate({ body });
      expect(status).toBe(400);
      expect((responseBody.error as Record<string, unknown>).code).toBe(
        'invalid_input',
      );
    }
    expect(mocks.createProjectProfile).not.toHaveBeenCalled();
  });

  it('creates successfully with the exact response shape and no echoed parameters', async () => {
    const { status, body } = await invokeCreate({ body: VALID_BODY });
    expect(status).toBe(201);
    expect(Object.keys(body).sort()).toEqual([
      'createdAt',
      'externalReference',
      'profileId',
      'projectId',
      'requestId',
    ]);
    expect(body.externalReference).toBe('slice3-profile-1');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('personalityProfile');
    expect(serialized).not.toContain('emotionalSensitivity');
    expect(serialized).not.toContain('additionalTraits');
    expect(serialized).not.toContain('confidence');
    expect(mocks.createProjectProfile).toHaveBeenCalledWith({
      userId: USER_ID,
      organizationId: ORGANIZATION_ID,
      projectId: PROJECT_ID,
      requestId: expect.any(String),
      request: {
        externalReference: 'slice3-profile-1',
        personalityProfile: VALID_BODY.personalityProfile,
      },
    });
  });

  it('maps a duplicate external reference to 409 external_reference_conflict', async () => {
    mocks.createProjectProfile.mockRejectedValue(
      new ProfileError('external_reference_conflict'),
    );
    const { status, body } = await invokeCreate({ body: VALID_BODY });
    expect(status).toBe(409);
    expect((body.error as Record<string, unknown>).code).toBe(
      'external_reference_conflict',
    );
    expect((body.error as Record<string, unknown>).message).toBe(
      'A profile with this external reference already exists in this project.',
    );
    expect(JSON.stringify(body)).not.toContain('duplicate key');
  });

  it('maps unexpected failures to internal_error without leaking details', async () => {
    mocks.createProjectProfile.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "secret_idx"'),
    );
    const { status, body } = await invokeCreate({ body: VALID_BODY });
    expect(status).toBe(500);
    expect((body.error as Record<string, unknown>).code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('secret_idx');
  });

  it('never logs externalReference, parameters, or payloads', async () => {
    await invokeCreate({ body: VALID_BODY });
    for (const line of logged) {
      expect(line).not.toContain('slice3-profile-1');
      expect(line).not.toContain('emotionalSensitivity');
      expect(line).not.toContain('personalityProfile');
      expect(line).not.toContain('additionalTraits');
    }
  });
});
