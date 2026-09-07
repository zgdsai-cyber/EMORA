import { emotionNames } from '../domain/emotion-vector';
import type { EmotionName, EmotionVector } from '../domain/emotion-vector';
import { validateEmotionalMemory } from '../domain/emotional-memory';
import { validateEmotionVector } from '../domain/emotion-vector';
import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import type { EmotionalMemory } from '../domain/emotional-memory';
import { validateModelParameters, createDefaultModelParameters } from '../parameters/model-parameters';
import type { EmotionInfluence } from './types';

export function calculateMemoryStrength(memory: EmotionalMemory, referenceTimestamp: string): number {
  validateEmotionalMemory(memory);
  const reference = Date.parse(referenceTimestamp);
  const memoryTimestamp = Date.parse(memory.timestamp);
  if (Number.isNaN(reference)) {
    throw new InvalidDomainObjectError('Memory reference timestamp must be a valid date.');
  }
  if (memoryTimestamp > reference) {
    return 0;
  }
  const elapsedSeconds = (reference - memoryTimestamp) / 1000;
  return memory.intensity * memory.importance * Math.exp(-memory.decayRate * elapsedSeconds);
}

export function calculateMemoryInfluence(
  memories: readonly EmotionalMemory[] = [],
  currentVector: EmotionVector,
  referenceTimestamp: string,
  modelParameters = createDefaultModelParameters(),
): EmotionInfluence {
  validateEmotionVector(currentVector);
  const weights = validateModelParameters(modelParameters).dynamics.memoryWeights;
  const result = Object.fromEntries(emotionNames.map((emotion) => [emotion, 0])) as Record<EmotionName, number>;
  for (const memory of memories) {
    const strength = calculateMemoryStrength(memory, referenceTimestamp);
    for (const emotion of emotionNames) {
      result[emotion] += (memory.emotionalState.emotionVector[emotion] - currentVector[emotion]) * strength * weights[emotion];
    }
  }
  return Object.freeze(result);
}
