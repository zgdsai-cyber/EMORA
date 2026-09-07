import type { EmotionalEvent } from '../domain/emotional-event';
import { validateEmotionalEvent } from '../domain/emotional-event';
import { validateModelParameters, createDefaultModelParameters } from '../parameters/model-parameters';

export function calculateEventImpact(
  event: EmotionalEvent,
  modelParameters = createDefaultModelParameters(),
): number {
  validateEmotionalEvent(event);
  const parameters = validateModelParameters(modelParameters).dynamics.eventImpactWeights;
  return event.intensity * event.relevance * (parameters.surpriseBase + parameters.surpriseScale * event.surprise);
}
