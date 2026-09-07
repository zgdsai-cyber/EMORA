import { clamp01 } from '../math/ranges';
import { emotionNames, validateEmotionVector } from '../domain/emotion-vector';
import type { EmotionVector } from '../domain/emotion-vector';
import { validateModelParameters, createDefaultModelParameters } from '../parameters/model-parameters';
import type { EmotionInfluence } from './types';

export function applyTemporalStability(
  currentVector: EmotionVector,
  delta: EmotionInfluence,
  modelParameters = createDefaultModelParameters(),
): EmotionVector {
  validateEmotionVector(currentVector);
  for (const emotion of emotionNames) {
    if (!Number.isFinite(delta[emotion])) {
      throw new Error(`Temporal delta for ${emotion} must be finite.`);
    }
  }
  const stability = validateModelParameters(modelParameters).dynamics.stabilityWeights;
  return Object.freeze(
    Object.fromEntries(
      emotionNames.map((emotion) => [
        emotion,
        clamp01(currentVector[emotion] + delta[emotion] + stability.rate * (stability.baseline[emotion] - currentVector[emotion]), `state.${emotion}`),
      ]),
    ) as EmotionVector,
  );
}
