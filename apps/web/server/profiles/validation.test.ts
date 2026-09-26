import { describe, expect, it } from 'vitest';

import { ProfileError } from './errors';
import {
  MAX_ADDITIONAL_TRAITS,
  MAX_ADDITIONAL_TRAIT_KEY_LENGTH,
  parseCreateProfileRequest,
} from './validation';

/**
 * Slice 3 strict transport validation: unknown fields rejected at the top level
 * and inside personalityProfile; finite [0,1] computational fields; frozen
 * externalReference and additionalTraits bounds.
 */

const VALID_REQUEST = {
  externalReference: 'slice3-profile-1',
  personalityProfile: {
    emotionalSensitivity: 0.5,
    baselineTrust: 0.5,
    baselineAnxiety: 0.5,
    attachmentSensitivity: 0.5,
    nostalgiaSensitivity: 0.5,
    jealousySensitivity: 0.5,
  },
} as const;

function violation(action: () => unknown): {
  code?: string;
  status?: number;
} {
  try {
    action();
    return {};
  } catch (error) {
    const profileError = error as ProfileError;
    return {
      code: profileError.code,
      status: profileError.status,
    };
  }
}

describe('Slice 3 create-profile transport validation', () => {
  it('accepts the minimal request and returns the frozen shape', () => {
    const accepted = parseCreateProfileRequest(VALID_REQUEST);
    expect(accepted).toEqual({
      externalReference: 'slice3-profile-1',
      personalityProfile: {
        emotionalSensitivity: 0.5,
        baselineTrust: 0.5,
        baselineAnxiety: 0.5,
        attachmentSensitivity: 0.5,
        nostalgiaSensitivity: 0.5,
        jealousySensitivity: 0.5,
      },
    });
    expect(accepted.additionalTraits).toBeUndefined();
  });

  it('accepts additionalTraits metadata within the frozen bounds', () => {
    const accepted = parseCreateProfileRequest({
      ...VALID_REQUEST,
      additionalTraits: { name: 0.5, openness: 1 },
    });
    expect(accepted.additionalTraits).toEqual({ name: 0.5, openness: 1 });
  });

  it('rejects unknown top-level fields', () => {
    for (const body of [
      { ...VALID_REQUEST, name: 'x' },
      { ...VALID_REQUEST, profileData: {} },
      { ...VALID_REQUEST, id: 'x' },
      { ...VALID_REQUEST, description: 'x' },
      { ...VALID_REQUEST, externalId: 'x' },
      { ...VALID_REQUEST, emotionalTraits: {} },
      { ...VALID_REQUEST, modelParameters: {} },
    ]) {
      expect(violation(() => parseCreateProfileRequest(body))).toEqual({
        code: 'invalid_input',
        status: 400,
      });
    }
  });

  it('rejects unknown fields inside personalityProfile', () => {
    for (const extra of [
      { name: 'x' },
      { additionalTraits: { a: 0.5 } },
      { openness: 0.5 },
      { confidence: 0.5 },
    ]) {
      expect(
        violation(() =>
          parseCreateProfileRequest({
            ...VALID_REQUEST,
            personalityProfile: {
              ...VALID_REQUEST.personalityProfile,
              ...extra,
            },
          }),
        ),
      ).toEqual({ code: 'invalid_input', status: 400 });
    }
  });

  it('rejects missing or invalid externalReference', () => {
    for (const externalReference of [
      undefined,
      null,
      42,
      '',
      'x'.repeat(129),
      'non-printable-\n',
      'tab\t',
    ]) {
      expect(
        violation(() =>
          parseCreateProfileRequest({ ...VALID_REQUEST, externalReference }),
        ),
      ).toEqual({ code: 'invalid_input', status: 400 });
    }
  });

  it('accepts boundary externalReference lengths', () => {
    for (const externalReference of ['x', 'a'.repeat(128)]) {
      const accepted = parseCreateProfileRequest({
        ...VALID_REQUEST,
        externalReference,
      });
      expect(accepted.externalReference).toBe(externalReference);
    }
  });

  it('rejects missing, non-finite, or out-of-range computational fields', () => {
    for (const trait of [
      undefined,
      null,
      '0.5',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0.1,
      1.1,
    ]) {
      expect(
        violation(() =>
          parseCreateProfileRequest({
            ...VALID_REQUEST,
            personalityProfile: {
              ...VALID_REQUEST.personalityProfile,
              emotionalSensitivity: trait,
            },
          }),
        ),
      ).toEqual({ code: 'invalid_input', status: 400 });
    }
  });

  it('accepts boundary [0,1] computational values', () => {
    const accepted = parseCreateProfileRequest({
      ...VALID_REQUEST,
      personalityProfile: {
        emotionalSensitivity: 0,
        baselineTrust: 1,
        baselineAnxiety: 0,
        attachmentSensitivity: 1,
        nostalgiaSensitivity: 0,
        jealousySensitivity: 1,
      },
    });
    expect(accepted.personalityProfile.emotionalSensitivity).toBe(0);
    expect(accepted.personalityProfile.baselineTrust).toBe(1);
  });

  it('rejects a missing computational field', () => {
    const missing: Record<string, unknown> = {
      ...VALID_REQUEST.personalityProfile,
    };
    delete missing.jealousySensitivity;
    expect(
      violation(() =>
        parseCreateProfileRequest({
          ...VALID_REQUEST,
          personalityProfile: missing,
        }),
      ),
    ).toEqual({ code: 'invalid_input', status: 400 });
  });

  it('fails closed for invalid additionalTraits', () => {
    for (const additionalTraits of [
      'not-an-object',
      [],
      null,
      42,
      { '': 0.5 },
      { key: '0.5' },
      { key: Number.NaN },
      { key: Number.POSITIVE_INFINITY },
      { key: -0.1 },
      { key: 1.1 },
    ]) {
      expect(
        violation(() =>
          parseCreateProfileRequest({ ...VALID_REQUEST, additionalTraits }),
        ),
      ).toEqual({ code: 'invalid_input', status: 400 });
    }
  });

  it('enforces additionalTraits bounds (32 keys, 64-char keys)', () => {
    const tooMany: Record<string, number> = {};
    for (let index = 0; index <= MAX_ADDITIONAL_TRAITS; index += 1) {
      tooMany[`key-${index}`] = 0.5;
    }
    expect(
      violation(() =>
        parseCreateProfileRequest({
          ...VALID_REQUEST,
          additionalTraits: tooMany,
        }),
      ),
    ).toEqual({ code: 'invalid_input', status: 400 });

    expect(
      violation(() =>
        parseCreateProfileRequest({
          ...VALID_REQUEST,
          additionalTraits: {
            ['k'.repeat(MAX_ADDITIONAL_TRAIT_KEY_LENGTH + 1)]: 0.5,
          },
        }),
      ),
    ).toEqual({ code: 'invalid_input', status: 400 });

    // At the limit: 32 keys total, one of them 64 characters.
    const atLimit: Record<string, number> = {};
    for (let index = 0; index < MAX_ADDITIONAL_TRAITS - 1; index += 1) {
      atLimit[`key-${index}`] = 0.5;
    }
    atLimit['k'.repeat(MAX_ADDITIONAL_TRAIT_KEY_LENGTH)] = 1;
    const accepted = parseCreateProfileRequest({
      ...VALID_REQUEST,
      additionalTraits: atLimit,
    });
    expect(Object.keys(accepted.additionalTraits ?? {})).toHaveLength(
      MAX_ADDITIONAL_TRAITS,
    );
  });

  it('rejects non-object request bodies', () => {
    for (const body of [null, 'x', 42, [], { ...VALID_REQUEST, extra: 1 }]) {
      expect(violation(() => parseCreateProfileRequest(body))).toEqual({
        code: 'invalid_input',
        status: 400,
      });
    }
  });
});
