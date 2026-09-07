import { validateNormalized01, validateSignedNormalized } from '../math/ranges';

export interface EmotionalDimensions {
  readonly valence: number;
  readonly arousal: number;
  readonly intensity: number;
  readonly confidence: number;
}

export function createEmotionalDimensions(input: EmotionalDimensions): EmotionalDimensions {
  return Object.freeze({
    valence: validateSignedNormalized(input.valence, 'valence'),
    arousal: validateNormalized01(input.arousal, 'arousal'),
    intensity: validateNormalized01(input.intensity, 'intensity'),
    confidence: validateNormalized01(input.confidence, 'confidence'),
  });
}

export function validateEmotionalDimensions(
  dimensions: EmotionalDimensions,
): EmotionalDimensions {
  return createEmotionalDimensions(dimensions);
}
