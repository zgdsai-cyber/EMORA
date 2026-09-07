import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { validateEmotionVector } from './emotion-vector';
import type { EmotionVector } from './emotion-vector';
import { createEmotionalDimensions } from './emotional-dimensions';
import type { EmotionalDimensions } from './emotional-dimensions';
import type { ModelVersion } from './model-version';

export interface EmotionalState {
  readonly emotionVector: EmotionVector;
  readonly dimensions: EmotionalDimensions;
  readonly timestamp: string;
  readonly modelVersion?: ModelVersion;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createEmotionalState(input: EmotionalState): EmotionalState {
  if (!input || !input.emotionVector || !input.dimensions || !input.timestamp) {
    throw new InvalidDomainObjectError('State requires an emotion vector, dimensions, and timestamp.');
  }
  validateEmotionVector(input.emotionVector);
  if (Number.isNaN(Date.parse(input.timestamp))) {
    throw new InvalidDomainObjectError('State timestamp must be a valid date.');
  }
  return Object.freeze({
    ...input,
    emotionVector: Object.freeze({ ...input.emotionVector }),
    dimensions: createEmotionalDimensions(input.dimensions),
    modelVersion: input.modelVersion
      ? Object.freeze({
          ...input.modelVersion,
          metadata: input.modelVersion.metadata
            ? Object.freeze({ ...input.modelVersion.metadata })
            : undefined,
        })
      : undefined,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export function validateEmotionalState(state: EmotionalState): EmotionalState {
  return createEmotionalState(state);
}

export function cloneEmotionalState(state: EmotionalState): EmotionalState {
  return createEmotionalState({
    ...state,
    emotionVector: { ...state.emotionVector },
    dimensions: { ...state.dimensions },
    metadata: state.metadata ? { ...state.metadata } : undefined,
  });
}
