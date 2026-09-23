/**
 * Slice 1 error taxonomy and response envelope. Messages are fixed per code so
 * no stack trace, SQL, internal exception message, raw profile data, or request
 * payload can reach a client.
 */
export type TransitionErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'profile_not_found'
  | 'invalid_input'
  | 'invalid_content_type'
  | 'idempotency_key_required'
  | 'idempotency_conflict'
  | 'temporal_conflict'
  | 'profile_data_invalid'
  | 'concurrency_conflict'
  | 'internal_error';

export const TRANSITION_ERROR_STATUS: Readonly<
  Record<TransitionErrorCode, number>
> = Object.freeze({
  unauthenticated: 401,
  forbidden: 403,
  profile_not_found: 404,
  invalid_input: 400,
  invalid_content_type: 400,
  idempotency_key_required: 400,
  idempotency_conflict: 409,
  temporal_conflict: 409,
  profile_data_invalid: 500,
  concurrency_conflict: 409,
  internal_error: 500,
});

const SAFE_MESSAGES: Readonly<Record<TransitionErrorCode, string>> =
  Object.freeze({
    unauthenticated: 'A valid session is required.',
    forbidden: 'Project access is not permitted.',
    profile_not_found: 'The requested emotional profile is not available.',
    invalid_input: 'The request is not valid.',
    invalid_content_type: 'The request body must be JSON.',
    idempotency_key_required: 'An Idempotency-Key header is required.',
    idempotency_conflict:
      'This Idempotency-Key was already used with a different request.',
    temporal_conflict:
      'The supplied timestamp precedes the latest persisted state.',
    profile_data_invalid:
      'The stored emotional profile data is not valid. The transition was not applied.',
    concurrency_conflict:
      'The transition could not be serialized. Retry the request.',
    internal_error: 'The transition could not be completed.',
  });

export class TransitionError extends Error {
  readonly code: TransitionErrorCode;
  readonly status: number;
  /** Operational (log-only) category. Never sent to the client. */
  readonly errorCategory: string;

  constructor(
    code: TransitionErrorCode,
    errorCategory: string = code,
    message?: string,
  ) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = 'TransitionError';
    this.code = code;
    this.status = TRANSITION_ERROR_STATUS[code];
    this.errorCategory = errorCategory;
  }
}

export interface TransitionErrorEnvelope {
  readonly error: {
    readonly code: TransitionErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export function toErrorEnvelope(
  error: TransitionError,
  requestId: string,
): TransitionErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      requestId,
    },
  };
}
