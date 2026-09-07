import { createEmotionalDimensions } from '../domain/emotional-dimensions';
import type { EmotionalDimensions } from '../domain/emotional-dimensions';
import type { EmotionVector } from '../domain/emotion-vector';
import { clampSignedNormalized, validateNormalized01, validateSignedNormalized } from '../math/ranges';
import type { EventFeatureVector } from './types';

export function calculateContinuousDimensions(
  vector: EmotionVector,
  features: EventFeatureVector,
  confidence: number,
): EmotionalDimensions {
  validateSignedNormalized(features.valence, 'features.valence');
  validateNormalized01(features.intensity, 'features.intensity');
  validateNormalized01(features.relevance, 'features.relevance');
  validateNormalized01(features.surprise, 'features.surprise');
  validateNormalized01(features.uncertainty, 'features.uncertainty');
  validateNormalized01(confidence, 'confidence');
  const positive = (vector.love + vector.trust + vector.joy) / 3;
  const negative = (vector.fear + vector.jealousy + vector.anger) / 3;
  const valence = clampSignedNormalized(positive - negative + features.valence * 0.25);
  const arousal = validateNormalized01((vector.fear + vector.anger + vector.joy + vector.jealousy) / 4);
  const intensity = validateNormalized01(Object.values(vector).reduce((sum, value) => sum + value, 0) / 7);
  return createEmotionalDimensions({
    valence,
    arousal,
    intensity,
    confidence: validateNormalized01(confidence),
  });
}
