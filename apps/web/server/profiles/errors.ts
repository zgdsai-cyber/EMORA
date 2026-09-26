/**
 * Slice 3 error taxonomy and response envelope. Messages are fixed per code so
 * no stack trace, SQL, internal exception message, raw profile data, or request
 * payload can reach a client. Mirrors the Slice 1/2 envelope shape
 * (`{ error: { code, message, requestId } }`) for a single transport contract.
 */
export type ProjectDiscoveryErrorCode =
  | 'unauthenticated'
  | 'invalid_input'
  | 'internal_error';

export type ProfileListErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'internal_error';

export type ProfileCreateErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'invalid_content_type'
  | 'external_reference_conflict'
  | 'internal_error';

export type ProfileErrorCode =
  | ProjectDiscoveryErrorCode
  | ProfileListErrorCode
  | ProfileCreateErrorCode;

export const PROFILE_ERROR_STATUS: Readonly<
  Record<ProfileErrorCode, number>
> = Object.freeze({
  unauthenticated: 401,
  forbidden: 403,
  invalid_input: 400,
  invalid_content_type: 400,
  external_reference_conflict: 409,
  internal_error: 500,
});

const SAFE_MESSAGES: Readonly<Record<ProfileErrorCode, string>> =
  Object.freeze({
    unauthenticated: 'A valid session is required.',
    forbidden: 'Project access is not permitted.',
    invalid_input: 'The request is not valid.',
    invalid_content_type: 'The request body must be JSON.',
    external_reference_conflict:
      'A profile with this external reference already exists in this project.',
    internal_error: 'The request could not be completed.',
  });

export class ProfileError extends Error {
  readonly code: ProfileErrorCode;
  readonly status: number;
  /** Operational (log-only) category. Never sent to the client. */
  readonly errorCategory: string;

  constructor(
    code: ProfileErrorCode,
    errorCategory: string = code,
    message?: string,
  ) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = 'ProfileError';
    this.code = code;
    this.status = PROFILE_ERROR_STATUS[code];
    this.errorCategory = errorCategory;
  }
}

export interface ProfileErrorEnvelope {
  readonly error: {
    readonly code: ProfileErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export function toErrorEnvelope(
  error: ProfileError,
  requestId: string,
): ProfileErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      requestId,
    },
  };
}