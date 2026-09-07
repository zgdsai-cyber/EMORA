import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { clamp01, validateNormalized01 } from '../math/ranges';

export const emotionNames = [
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
] as const;

export type EmotionName = (typeof emotionNames)[number];
export type NormalizedValue = number;

export type EmotionVector = Readonly<Record<EmotionName, NormalizedValue>>;
export type EmotionVectorInput = Partial<Record<EmotionName, number>>;

export function createEmotionVector(input: EmotionVectorInput = {}): EmotionVector {
  const vector = {} as Record<EmotionName, number>;
  for (const emotion of emotionNames) {
    vector[emotion] = validateNormalized01(input[emotion] ?? 0, `emotion.${emotion}`);
  }
  return Object.freeze(vector);
}

export function zeroEmotionVector(): EmotionVector {
  return createEmotionVector();
}

export function validateEmotionVector(vector: EmotionVector): EmotionVector {
  if (!vector || typeof vector !== 'object') {
    throw new InvalidDomainObjectError('Emotion vector must be an object.');
  }
  for (const emotion of emotionNames) {
    validateNormalized01(vector[emotion], `emotion.${emotion}`);
  }
  return vector;
}

export function addEmotionVectors(
  left: EmotionVector,
  right: EmotionVector,
): EmotionVector {
  validateEmotionVector(left);
  validateEmotionVector(right);
  return createEmotionVector(
    Object.fromEntries(
      emotionNames.map((emotion) => [emotion, left[emotion] + right[emotion]]),
    ) as EmotionVectorInput,
  );
}

export function mergeEmotionVectors(
  left: EmotionVector,
  right: EmotionVector,
  weight = 0.5,
): EmotionVector {
  validateNormalized01(weight, 'weight');
  validateEmotionVector(left);
  validateEmotionVector(right);
  return createEmotionVector(
    Object.fromEntries(
      emotionNames.map((emotion) => [
        emotion,
        left[emotion] * (1 - weight) + right[emotion] * weight,
      ]),
    ) as EmotionVectorInput,
  );
}

export function scaleEmotionVector(
  vector: EmotionVector,
  factor: number,
): EmotionVector {
  validateEmotionVector(vector);
  if (!Number.isFinite(factor) || factor < 0) {
    throw new InvalidDomainObjectError('Scale factor must be a finite non-negative number.');
  }
  return createEmotionVector(
    Object.fromEntries(
      emotionNames.map((emotion) => [emotion, vector[emotion] * factor]),
    ) as EmotionVectorInput,
  );
}

export function clampEmotionVector(vector: EmotionVectorInput): EmotionVector {
  return createEmotionVector(
    Object.fromEntries(
      emotionNames.map((emotion) => [
        emotion,
        clamp01(vector[emotion] ?? 0, `emotion.${emotion}`),
      ]),
    ) as EmotionVectorInput,
  );
}

export function calculateDominantEmotion(vector: EmotionVector): EmotionName | null {
  validateEmotionVector(vector);
  let dominant: EmotionName | null = null;
  let highest = 0;
  for (const emotion of emotionNames) {
    if (vector[emotion] > highest) {
      dominant = emotion;
      highest = vector[emotion];
    }
  }
  return dominant;
}