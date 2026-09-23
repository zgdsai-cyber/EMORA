import { describe, expect, it } from 'vitest';

import { TransitionError } from './errors';
import { toPersonalityProfile } from './personality-profile';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

const VALID_DATA = {
  personalityProfile: {
    emotionalSensitivity: 0.8,
    baselineTrust: 0.6,
    baselineAnxiety: 0.4,
    attachmentSensitivity: 0.7,
    nostalgiaSensitivity: 0.6,
    jealousySensitivity: 0.7,
    additionalTraits: { openness: 0.5 },
  },
};

function violation(action: () => unknown): {
  code?: string;
  status?: number;
  category?: string;
} {
  try {
    action();
    return {};
  } catch (error) {
    if (error instanceof TransitionError) {
      return {
        code: error.code,
        status: error.status,
        category: error.errorCategory,
      };
    }
    throw error;
  }
}

const INTEGRITY = {
  code: 'profile_data_invalid',
  status: 500,
  category: 'profile_data_integrity',
};

describe('Slice 1 profile_data -> PersonalityProfile mapping', () => {
  it('maps the frozen structure and uses the profile row id as PersonalityProfile.id', () => {
    const profile = toPersonalityProfile(PROFILE_ID, VALID_DATA);
    expect(profile).toEqual({
      id: PROFILE_ID,
      emotionalSensitivity: 0.8,
      baselineTrust: 0.6,
      baselineAnxiety: 0.4,
      attachmentSensitivity: 0.7,
      nostalgiaSensitivity: 0.6,
      jealousySensitivity: 0.7,
      additionalTraits: { openness: 0.5 },
    });
  });

  it('never uses an external reference as the identity', () => {
    const profile = toPersonalityProfile(
      'external-reference-value',
      VALID_DATA,
    );
    expect(profile.id).toBe('external-reference-value');
    expect(profile.id).not.toBe(
      VALID_DATA.personalityProfile.attachmentSensitivity,
    );
  });

  it('accepts a profile without additionalTraits', () => {
    const profile = toPersonalityProfile(PROFILE_ID, {
      personalityProfile: {
        emotionalSensitivity: 0.5,
        baselineTrust: 0.5,
        baselineAnxiety: 0.5,
        attachmentSensitivity: 0.5,
        nostalgiaSensitivity: 0.5,
        jealousySensitivity: 0.5,
      },
    });
    expect(profile.additionalTraits).toBeUndefined();
    expect(profile.emotionalSensitivity).toBe(0.5);
  });

  it('fails closed when the personality block is missing or not an object', () => {
    for (const data of [
      {},
      { personalityProfile: null },
      { personalityProfile: [] },
      { personalityProfile: 'text' },
      { other: {} },
      null,
      [],
      'text',
      7,
    ]) {
      expect(violation(() => toPersonalityProfile(PROFILE_ID, data))).toEqual(
        INTEGRITY,
      );
    }
  });

  it('fails closed for every missing required trait instead of defaulting', () => {
    for (const trait of [
      'emotionalSensitivity',
      'baselineTrust',
      'baselineAnxiety',
      'attachmentSensitivity',
      'nostalgiaSensitivity',
      'jealousySensitivity',
    ]) {
      const block: Record<string, unknown> = {
        ...VALID_DATA.personalityProfile,
      };
      delete block[trait];
      expect(
        violation(() =>
          toPersonalityProfile(PROFILE_ID, { personalityProfile: block }),
        ),
      ).toEqual(INTEGRITY);
    }
  });

  it('fails closed for non-numeric, non-finite, and out-of-range traits', () => {
    for (const value of [
      '0.5',
      null,
      true,
      {},
      Number.NaN,
      Infinity,
      -Infinity,
      1.5,
      -0.1,
      100,
    ]) {
      expect(
        violation(() =>
          toPersonalityProfile(PROFILE_ID, {
            personalityProfile: {
              ...VALID_DATA.personalityProfile,
              baselineTrust: value,
            },
          }),
        ),
      ).toEqual(INTEGRITY);
    }
  });

  it('fails closed for unknown keys inside the personality block', () => {
    for (const key of ['extraTrait', 'baselineAnger', 'valence', 'score']) {
      expect(
        violation(() =>
          toPersonalityProfile(PROFILE_ID, {
            personalityProfile: {
              ...VALID_DATA.personalityProfile,
              [key]: 0.5,
            },
          }),
        ),
      ).toEqual(INTEGRITY);
    }
  });

  it('fails closed for invalid additionalTraits', () => {
    for (const additionalTraits of [
      'not-an-object',
      [],
      { openness: '0.5' },
      { openness: Number.NaN },
      { openness: Infinity },
      { openness: 1.5 },
      { openness: -0.2 },
      { '': 0.5 },
    ]) {
      expect(
        violation(() =>
          toPersonalityProfile(PROFILE_ID, {
            personalityProfile: {
              ...VALID_DATA.personalityProfile,
              additionalTraits,
            },
          }),
        ),
      ).toEqual(INTEGRITY);
    }
  });
});
