import { clampEmotionVector } from '../domain/emotion-vector';
import type { EmotionVector } from '../domain/emotion-vector';
import { validateModelParameters, createDefaultModelParameters } from '../parameters/model-parameters';
import type { EventFeatureVector } from './types';
import { validateNormalized01, validateSignedNormalized } from '../math/ranges';

export function calculateBaseEmotionInfluence(
  features: EventFeatureVector,
  eventImpact: number,
  modelParameters = createDefaultModelParameters(),
): EmotionVector {
  validateSignedNormalized(features.valence, 'features.valence');
  validateNormalized01(features.intensity, 'features.intensity');
  validateNormalized01(features.relevance, 'features.relevance');
  validateNormalized01(features.surprise, 'features.surprise');
  validateNormalized01(features.uncertainty, 'features.uncertainty');
  validateNormalized01(eventImpact, 'eventImpact');
  const weights = validateModelParameters(modelParameters).dynamics.emotionWeights;
  const positive = Math.max(features.valence, 0);
  const negative = Math.max(-features.valence, 0);
  const influence = {
    love: eventImpact * (positive * weights.love.positive + features.relevance * weights.love.relevance),
    fear: eventImpact * (negative * weights.fear.negative + features.uncertainty * weights.fear.uncertainty),
    nostalgia: eventImpact * (features.relevance * weights.nostalgia.relevance + features.surprise * weights.nostalgia.surprise),
    jealousy: eventImpact * (features.uncertainty * weights.jealousy.uncertainty + negative * weights.jealousy.negative),
    trust: eventImpact * (positive * weights.trust.positive),
    anger: eventImpact * (negative * weights.anger.negative + features.relevance * weights.anger.relevance),
    joy: eventImpact * (positive * weights.joy.positive + features.surprise * weights.joy.surprise),
  };
  return clampEmotionVector(influence);
}
