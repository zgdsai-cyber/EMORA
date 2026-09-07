import { validateNormalized01 } from '../math/ranges';
import { InvalidDomainObjectError } from '../errors/emotional-core-error';

export interface PersonalityProfile {
  readonly id: string;
  readonly emotionalSensitivity: number;
  readonly baselineTrust: number;
  readonly baselineAnxiety: number;
  readonly attachmentSensitivity: number;
  readonly nostalgiaSensitivity: number;
  readonly jealousySensitivity: number;
  readonly additionalTraits?: Readonly<Record<string, number>>;
}

export function createPersonalityProfile(input: PersonalityProfile): PersonalityProfile {
  validatePersonalityProfile(input);
  return Object.freeze({
    ...input,
    additionalTraits: input.additionalTraits
      ? Object.freeze({ ...input.additionalTraits })
      : undefined,
  });
}

export function validatePersonalityProfile(profile: PersonalityProfile): PersonalityProfile {
  if (!profile.id) {
    throw new InvalidDomainObjectError('Personality profile requires an id.');
  }
  validateNormalized01(profile.emotionalSensitivity, 'personality.emotionalSensitivity');
  validateNormalized01(profile.baselineTrust, 'personality.baselineTrust');
  validateNormalized01(profile.baselineAnxiety, 'personality.baselineAnxiety');
  validateNormalized01(profile.attachmentSensitivity, 'personality.attachmentSensitivity');
  validateNormalized01(profile.nostalgiaSensitivity, 'personality.nostalgiaSensitivity');
  validateNormalized01(profile.jealousySensitivity, 'personality.jealousySensitivity');
  for (const [name, value] of Object.entries(profile.additionalTraits ?? {})) {
    validateNormalized01(value, `personality.${name}`);
  }
  return profile;
}
