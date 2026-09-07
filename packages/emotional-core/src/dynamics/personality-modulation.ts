import { validateNormalized01 } from '../math/ranges';
import { validatePersonalityProfile } from '../domain/personality-profile';
import { validateModelParameters, createDefaultModelParameters } from '../parameters/model-parameters';
import type { PersonalityProfile } from '../domain/personality-profile';
import type { DeterministicModelParameters } from '../parameters/model-parameters';
import type { PersonalityModifiers } from './types';

export function calculateTraitModifier(trait: number, sensitivityWeight: number): number {
  validateNormalized01(trait, 'trait');
  if (!Number.isFinite(sensitivityWeight) || sensitivityWeight < 0) {
    throw new Error('Sensitivity weight must be finite and non-negative.');
  }
  return Math.max(0, 1 + sensitivityWeight * (trait - 0.5));
}

export function calculatePersonalityModifiers(
  profile: PersonalityProfile,
  modelParameters: DeterministicModelParameters = createDefaultModelParameters(),
): PersonalityModifiers {
  validatePersonalityProfile(profile);
  const weights = validateModelParameters(modelParameters).dynamics.personalityWeights;
  return Object.freeze({
    emotionalSensitivity: calculateTraitModifier(profile.emotionalSensitivity, weights.emotionalSensitivity),
    baselineTrust: calculateTraitModifier(profile.baselineTrust, weights.baselineTrust),
    baselineAnxiety: calculateTraitModifier(profile.baselineAnxiety, weights.baselineAnxiety),
    attachmentSensitivity: calculateTraitModifier(profile.attachmentSensitivity, weights.attachmentSensitivity),
    nostalgiaSensitivity: calculateTraitModifier(profile.nostalgiaSensitivity, weights.nostalgiaSensitivity),
    jealousySensitivity: calculateTraitModifier(profile.jealousySensitivity, weights.jealousySensitivity),
  });
}
