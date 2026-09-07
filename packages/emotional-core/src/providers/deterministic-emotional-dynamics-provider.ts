import { createModelVersion } from '../domain/model-version';
import type { ModelVersion } from '../domain/model-version';
import type { StateTransitionInput, StateTransitionResult } from '../transition/transition-types';
import type { StateTransitionProvider } from '../transition/transition-provider';
import { calculateNextEmotionalState } from '../dynamics/calculate-next-state';
import { createDefaultModelParameters } from '../parameters/model-parameters';

export class DeterministicEmotionalDynamicsProvider implements StateTransitionProvider {
  readonly identifier = 'deterministic-emotional-dynamics';
  readonly modelVersion: ModelVersion = createModelVersion({
    id: 'emora-deterministic-dynamics',
    name: 'Deterministic Emotional Dynamics',
    version: '1.0.0',
  });

  transition(input: StateTransitionInput): StateTransitionResult {
    return calculateNextEmotionalState({
      ...input,
      modelParameters: input.modelParameters ?? createDefaultModelParameters(),
    });
  }
}
