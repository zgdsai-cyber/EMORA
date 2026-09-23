import { createPersonalityProfile } from '@emora/emotional-core';
import type { PersonalityProfile } from '@emora/emotional-core';

import { TransitionError } from './errors';

/**
 * Slice 1 profile-data mapper.
 *
 * Structural extraction ONLY — no mathematical logic, no defaults, no clamping.
 * Trait validation is delegated to the authoritative domain constructor
 * (createPersonalityProfile), whose normalized [0,1] rules are the single
 * source of truth. Missing or invalid persisted profile data fails closed:
 * this is server-owned data integrity, not client input error.
 */

const REQUIRED_TRAITS = [
  'emotionalSensitivity',
  'baselineTrust',
  'baselineAnxiety',
  'attachmentSensitivity',
  'nostalgiaSensitivity',
  'jealousySensitivity',
] as const;

function profileDataInvalid(): never {
  throw new TransitionError('profile_data_invalid', 'profile_data_integrity');
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

export function toPersonalityProfile(
  profileId: string,
  profileData: unknown,
): PersonalityProfile {
  if (!isPlainObject(profileData)) profileDataInvalid();

  const block = profileData.personalityProfile;
  if (!isPlainObject(block)) profileDataInvalid();

  // Unknown keys inside the personality block are rejected (only additionalTraits
  // may accompany the six required traits).
  for (const key of Object.keys(block)) {
    if (
      key !== 'additionalTraits' &&
      !(REQUIRED_TRAITS as readonly string[]).includes(key)
    ) {
      profileDataInvalid();
    }
  }

  const traits: Record<string, number> = {};
  for (const trait of REQUIRED_TRAITS) {
    const value = block[trait];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      profileDataInvalid();
    }
    traits[trait] = value;
  }

  let additionalTraits: Record<string, number> | undefined;
  if (block.additionalTraits !== undefined) {
    if (!isPlainObject(block.additionalTraits)) profileDataInvalid();
    additionalTraits = {};
    for (const [name, value] of Object.entries(block.additionalTraits)) {
      if (name.length === 0) profileDataInvalid();
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        profileDataInvalid();
      }
      additionalTraits[name] = value;
    }
  }

  try {
    return createPersonalityProfile({
      id: profileId,
      emotionalSensitivity: traits.emotionalSensitivity,
      baselineTrust: traits.baselineTrust,
      baselineAnxiety: traits.baselineAnxiety,
      attachmentSensitivity: traits.attachmentSensitivity,
      nostalgiaSensitivity: traits.nostalgiaSensitivity,
      jealousySensitivity: traits.jealousySensitivity,
      ...(additionalTraits ? { additionalTraits } : {}),
    });
  } catch {
    // Domain rejection (e.g. out-of-range trait) is a data-integrity failure.
    profileDataInvalid();
  }
}
