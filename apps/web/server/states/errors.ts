/**
 * Slice 2 error taxonomy and response envelope. Messages are fixed per code so
 * no stack trace, SQL, internal exception message, raw persisted state, or
 * request payload can reach a client. Mirrors the Slice 1 envelope shape
 * (`{ error: { code, message, requestId } }`) for a single transport contract.
 */
export type StateReadErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_input'
  | 'state_not_found'
  | 'state_data_invalid'
  | 'internal_error';

export const STATE_READ_ERROR_STATUS: Readonly<
  Record<StateReadErrorCode, number>
> = Object.freeze({
  unauthenticated: 401,
  forbidden: 403,
  invalid_input: 400,
  state_not_found: 404,
  state_data_invalid: 500,
  internal_error: 500,
});

const SAFE_MESSAGES: Readonly<Record<StateReadErrorCode, string>> =
  Object.freeze({
    unauthenticated: 'A valid session is required.',
    forbidden: 'Project access is not permitted.',
    invalid_input: 'The request is not valid.',
    state_not_found: 'The requested emotional state is not available.',
    state_data_invalid:
      'The stored emotional state is not valid. The state was not returned.',
    internal_error: 'The state could not be read.',
  });

export class StateReadError extends Error {
  readonly code: StateReadErrorCode;
  readonly status: number;
  /** Operational (log-only) category. Never sent to the client. */
  readonly errorCategory: string;

  constructor(
    code: StateReadErrorCode,
    errorCategory: string = code,
    message?: string,
  ) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = 'StateReadError';
    this.code = code;
    this.status = STATE_READ_ERROR_STATUS[code];
    this.errorCategory = errorCategory;
  }
}

export interface StateReadErrorEnvelope {
  readonly error: {
    readonly code: StateReadErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export function toErrorEnvelope(
  error: StateReadError,
  requestId: string,
): StateReadErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      requestId,
    },
  };
}
