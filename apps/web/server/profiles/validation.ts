import { z } from 'zod';

import { ProfileError } from './errors';

/**
 * Slice 3 transport validation. Transport rules only: shape, strictness,
 * ranges, finiteness, unknown-field rejection, and the frozen
 * `externalReference` / `additionalTraits` bounds. Domain invariants remain
 * authoritative inside @emora/emotional-core and are re-checked there at
 * creation time by `createPersonalityProfile`.
 */

/** Frozen Slice 3 external-reference bounds (printable ASCII, 1–128 chars). */
export const EXTERNAL_REFERENCE_MIN_LENGTH = 1;
export const EXTERNAL_REFERENCE_MAX_LENGTH = 128;

/** Frozen Slice 3 additionalTraits bounds. */
export const MAX_ADDITIONAL_TRAITS = 32;
export const MAX_ADDITIONAL_TRAIT_KEY_LENGTH = 64;

const EXTERNAL_REFERENCE = /^[\x20-\x7e]+$/;

function invalidInput(): never {
  throw new ProfileError('invalid_input');
}

const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), 'must be a finite number');

const normalizedNumber = finiteNumber.refine(
  (value) => value >= 0 && value <= 1,
  'must be between 0 and 1',
);

const personalityProfileSchema = z.strictObject({
  emotionalSensitivity: normalizedNumber,
  baselineTrust: normalizedNumber,
  baselineAnxiety: normalizedNumber,
  attachmentSensitivity: normalizedNumber,
  nostalgiaSensitivity: normalizedNumber,
  jealousySensitivity: normalizedNumber,
});

const requestSchema = z.strictObject({
  externalReference: z.string(),
  personalityProfile: personalityProfileSchema,
  additionalTraits: z.unknown().optional(),
});

export interface AcceptedPersonalityProfile {
  readonly emotionalSensitivity: number;
  readonly baselineTrust: number;
  readonly baselineAnxiety: number;
  readonly attachmentSensitivity: number;
  readonly nostalgiaSensitivity: number;
  readonly jealousySensitivity: number;
}

export interface AcceptedCreateProfileRequest {
  readonly externalReference: string;
  readonly personalityProfile: AcceptedPersonalityProfile;
  readonly additionalTraits?: Readonly<Record<string, number>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function parseExternalReference(value: string): string {
  if (
    value.length < EXTERNAL_REFERENCE_MIN_LENGTH ||
    value.length > EXTERNAL_REFERENCE_MAX_LENGTH
  ) {
    invalidInput();
  }
  if (!EXTERNAL_REFERENCE.test(value)) invalidInput();
  return value;
}

/**
 * Optional metadata map: ≤32 keys, key length 1–64, finite [0,1] values.
 * Stored metadata only — never consumed by deterministic dynamics.
 */
function parseAdditionalTraits(
  value: unknown,
): Record<string, number> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) invalidInput();
  const entries = Object.entries(value);
  if (entries.length > MAX_ADDITIONAL_TRAITS) invalidInput();
  const result: Record<string, number> = {};
  for (const [name, trait] of entries) {
    if (
      name.length < 1 ||
      name.length > MAX_ADDITIONAL_TRAIT_KEY_LENGTH
    ) {
      invalidInput();
    }
    if (typeof trait !== 'number' || !Number.isFinite(trait)) invalidInput();
    if (trait < 0 || trait > 1) invalidInput();
    result[name] = trait;
  }
  return result;
}

/**
 * Strict parse of POST /api/v1/projects/{projectId}/profiles. Unknown fields
 * are rejected at the top level and inside `personalityProfile`. Invalid input
 * throws `ProfileError('invalid_input')` before any persistence or audit.
 */
export function parseCreateProfileRequest(
  value: unknown,
): AcceptedCreateProfileRequest {
  const result = requestSchema.safeParse(value);
  if (!result.success) invalidInput();
  const data = result.data as Record<string, unknown>;
  const personalityProfile = data.personalityProfile as Record<string, unknown>;

  const additionalTraits = parseAdditionalTraits(data.additionalTraits);
  return {
    externalReference: parseExternalReference(
      data.externalReference as string,
    ),
    personalityProfile: {
      emotionalSensitivity: personalityProfile.emotionalSensitivity as number,
      baselineTrust: personalityProfile.baselineTrust as number,
      baselineAnxiety: personalityProfile.baselineAnxiety as number,
      attachmentSensitivity:
        personalityProfile.attachmentSensitivity as number,
      nostalgiaSensitivity: personalityProfile.nostalgiaSensitivity as number,
      jealousySensitivity: personalityProfile.jealousySensitivity as number,
    },
    ...(additionalTraits ? { additionalTraits } : {}),
  };
}