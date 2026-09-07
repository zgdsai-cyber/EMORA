import { validateEmotionalEvent } from '../domain/emotional-event';
import type { EmotionalEvent } from '../domain/emotional-event';
import type { EventFeatureVector } from './types';

export function extractEventFeatures(event: EmotionalEvent): EventFeatureVector {
  validateEmotionalEvent(event);
  return Object.freeze({
    valence: event.valence,
    intensity: event.intensity,
    relevance: event.relevance,
    surprise: event.surprise,
    uncertainty: event.uncertainty,
  });
}
