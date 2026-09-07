import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { validateNormalized01, validateSignedNormalized } from '../math/ranges';

export type EmotionalEventSource = string & { readonly __eventSource: unique symbol };

export function createEventSource(source: string): EmotionalEventSource {
  if (source.trim().length === 0) {
    throw new InvalidDomainObjectError('Event source must not be empty.');
  }
  return source as EmotionalEventSource;
}

export interface EmotionalEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly source: EmotionalEventSource;
  readonly valence: number;
  readonly intensity: number;
  readonly relevance: number;
  readonly surprise: number;
  readonly uncertainty: number;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createEmotionalEvent(input: EmotionalEvent): EmotionalEvent {
  validateEmotionalEvent(input);
  return Object.freeze({
    ...input,
    context: input.context ? Object.freeze({ ...input.context }) : undefined,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export function validateEmotionalEvent(event: EmotionalEvent): EmotionalEvent {
  if (!event.id || !event.timestamp || !event.source) {
    throw new InvalidDomainObjectError('Emotional event requires id, timestamp, and source.');
  }
  if (Number.isNaN(Date.parse(event.timestamp))) {
    throw new InvalidDomainObjectError('Emotional event timestamp must be a valid date.');
  }
  validateSignedNormalized(event.valence, 'event.valence');
  validateNormalized01(event.intensity, 'event.intensity');
  validateNormalized01(event.relevance, 'event.relevance');
  validateNormalized01(event.surprise, 'event.surprise');
  validateNormalized01(event.uncertainty, 'event.uncertainty');
  return event;
}
