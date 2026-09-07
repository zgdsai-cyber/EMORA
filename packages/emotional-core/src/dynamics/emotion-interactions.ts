import { emotionNames, validateEmotionVector } from '../domain/emotion-vector';
import type { EmotionName, EmotionVector } from '../domain/emotion-vector';
import { validateModelParameters, createDefaultModelParameters } from '../parameters/model-parameters';
import type { EmotionInfluence } from './types';

export function applyEmotionInteractions(
  influence: EmotionVector,
  modelParameters = createDefaultModelParameters(),
): EmotionInfluence {
  validateEmotionVector(influence);
  const matrix = validateModelParameters(modelParameters).dynamics.interactionWeights;
  const result = Object.fromEntries(emotionNames.map((emotion) => [emotion, 0])) as Record<EmotionName, number>;
  for (const source of emotionNames) {
    for (const target of emotionNames) {
      result[target] += influence[source] * matrix[source][target];
    }
  }
  return Object.freeze(result);
}
