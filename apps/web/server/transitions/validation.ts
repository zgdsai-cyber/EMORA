import { z } from 'zod';

import { TransitionError } from './errors';

/**
 * Slice 1 transport validation. Transport rules only: shape, ranges, finiteness,
 * unknown-field rejection, and bounded context. Domain invariants remain
 * authoritative inside @emora/emotional-core and are not duplicated here.
 */

const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), 'must be a finite number');

/**
 * Frozen Slice 1 bounded-context contract (authoritative limits).
 *
 * - MAX_CONTEXT_SERIALIZED_BYTES: maximum UTF-8 byte length of the serialized
 *   accepted context (8192 bytes are accepted; 8193 is rejected).
 * - MAX_CONTEXT_DEPTH: maximum object nesting depth, where the root object is
 *   depth 1 (three object levels accepted; a fourth is rejected).
 * - MAX_CONTEXT_KEYS: maximum total key count across the whole accepted object
 *   tree — not merely the root keys.
 */
export const MAX_CONTEXT_SERIALIZED_BYTES = 8192;
export const MAX_CONTEXT_DEPTH = 3;
export const MAX_CONTEXT_KEYS = 32;
export const MAX_CONTEXT_KEY_LENGTH = 64;
export const MAX_CONTEXT_STRING_LENGTH = 512;

export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const IDEMPOTENCY_KEY = /^[\x20-\x7e]+$/;

const requestSchema = z.strictObject({
  valence: finiteNumber.refine(
    (value) => value >= -1 && value <= 1,
    'must be between -1 and 1',
  ),
  intensity: finiteNumber.refine(
    (value) => value >= 0 && value <= 1,
    'must be between 0 and 1',
  ),
  relevance: finiteNumber.refine(
    (value) => value >= 0 && value <= 1,
    'must be between 0 and 1',
  ),
  surprise: finiteNumber.refine(
    (value) => value >= 0 && value <= 1,
    'must be between 0 and 1',
  ),
  uncertainty: finiteNumber.refine(
    (value) => value >= 0 && value <= 1,
    'must be between 0 and 1',
  ),
  context: z.unknown().optional(),
  timestamp: z.string().optional(),
});

export type ContextValue =
  string | number | boolean | { readonly [key: string]: ContextValue };

export interface AcceptedTransitionRequest {
  readonly valence: number;
  readonly intensity: number;
  readonly relevance: number;
  readonly surprise: number;
  readonly uncertainty: number;
  readonly context?: Readonly<Record<string, ContextValue>>;
  /** Canonical UTC ISO-8601 milliseconds. */
  readonly timestamp?: string;
}

function invalidInput(): never {
  throw new TransitionError('invalid_input');
}

/**
 * Deterministic UTF-8 byte length of the serialized context. Uses
 * Buffer.byteLength(..., 'utf8') — never JavaScript character count.
 */
export function serializedContextBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

/**
 * Bounded context validation: object only, leaf primitives only, total key
 * budget shared across the whole tree, and a hard object-depth ceiling.
 */
function validateContextValue(
  value: unknown,
  depth: number,
  keyBudget: { remaining: number },
): ContextValue {
  if (typeof value === 'string') {
    if (value.length > MAX_CONTEXT_STRING_LENGTH) invalidInput();
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalidInput();
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || Array.isArray(value)) {
    invalidInput();
  }
  if (typeof value !== 'object') invalidInput();
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    invalidInput();
  }
  // The root object is depth 1, so three object levels are accepted.
  if (depth > MAX_CONTEXT_DEPTH) invalidInput();

  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, ContextValue> = {};
  for (const [key, nested] of entries) {
    if (key.length === 0 || key.length > MAX_CONTEXT_KEY_LENGTH) invalidInput();
    keyBudget.remaining -= 1;
    if (keyBudget.remaining < 0) invalidInput();
    result[key] = validateContextValue(nested, depth + 1, keyBudget);
  }
  return result;
}

function parseContext(value: unknown): Readonly<Record<string, ContextValue>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    invalidInput();
  }
  const context = validateContextValue(value, 1, {
    remaining: MAX_CONTEXT_KEYS,
  }) as Readonly<Record<string, ContextValue>>;
  if (serializedContextBytes(context) > MAX_CONTEXT_SERIALIZED_BYTES) {
    invalidInput();
  }
  return context;
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) invalidInput();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) invalidInput();
  return new Date(parsed).toISOString();
}

export function parseTransitionRequest(
  value: unknown,
): AcceptedTransitionRequest {
  const result = requestSchema.safeParse(value);
  if (!result.success) invalidInput();
  const data = result.data as Record<string, unknown>;

  return {
    valence: data.valence as number,
    intensity: data.intensity as number,
    relevance: data.relevance as number,
    surprise: data.surprise as number,
    uncertainty: data.uncertainty as number,
    ...(data.context === undefined
      ? {}
      : { context: parseContext(data.context) }),
    ...(data.timestamp === undefined
      ? {}
      : { timestamp: parseTimestamp(data.timestamp) }),
  };
}

export function parseIdempotencyKey(value: string | null): string {
  if (value === null) {
    throw new TransitionError('idempotency_key_required');
  }
  if (
    value.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    value.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
    !IDEMPOTENCY_KEY.test(value)
  ) {
    throw new TransitionError('idempotency_key_required');
  }
  return value;
}
