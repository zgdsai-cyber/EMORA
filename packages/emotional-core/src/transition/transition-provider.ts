import type { StateTransitionInput, StateTransitionResult } from './transition-types';
import type { ModelVersion } from '../domain/model-version';

export interface StateTransitionProvider {
  readonly identifier: string;
  readonly modelVersion?: ModelVersion;
  transition(input: StateTransitionInput): StateTransitionResult;
}
