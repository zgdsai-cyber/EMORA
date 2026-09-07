import type { EmotionalState } from '../domain/emotional-state';
import type { ModelVersion } from '../domain/model-version';
import type { StateTransitionInput } from '../transition/transition-types';
import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { validateEmotionalState } from '../domain/emotional-state';
import { validateNormalized01 } from '../math/ranges';
import { deepCloneAndFreeze } from '../utils/deep-immutable';

export interface MLEmotionalStatePrediction {
  readonly state: EmotionalState;
  readonly confidence: number;
  readonly modelIdentifier: string;
  readonly modelVersion?: ModelVersion;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface MLEmotionalStateProvider {
  readonly identifier: string;
  readonly modelVersion?: ModelVersion;
  predict(input: StateTransitionInput): MLEmotionalStatePrediction;
}

export function validateMLPrediction(
  prediction: MLEmotionalStatePrediction,
): MLEmotionalStatePrediction {
  if (!prediction.modelIdentifier || prediction.modelIdentifier.trim().length === 0) {
    throw new InvalidDomainObjectError('ML prediction requires a model identifier.');
  }
  validateEmotionalState(prediction.state);
  validateNormalized01(prediction.confidence, 'mlPrediction.confidence');
  return prediction;
}

export function createMLPrediction(
  input: MLEmotionalStatePrediction,
): MLEmotionalStatePrediction {
  validateMLPrediction(input);
  return Object.freeze({
    ...input,
    state: deepCloneAndFreeze(input.state),
    metadata: input.metadata ? deepCloneAndFreeze(input.metadata) : undefined,
    modelVersion: input.modelVersion ? deepCloneAndFreeze(input.modelVersion) : undefined,
  });
}
