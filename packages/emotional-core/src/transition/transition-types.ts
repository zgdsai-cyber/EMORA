import type { EmotionalEvent } from '../domain/emotional-event';
import type { EmotionalMemory } from '../domain/emotional-memory';
import type { ModelParameters } from '../domain/model-parameters';
import type { EmotionalState } from '../domain/emotional-state';
import type { PersonalityProfile } from '../domain/personality-profile';

export interface StateTransitionInput {
  readonly currentState: EmotionalState;
  readonly event: EmotionalEvent;
  readonly personalityProfile: PersonalityProfile;
  readonly memories?: readonly EmotionalMemory[];
  readonly modelParameters?: ModelParameters;
}

export interface StateTransitionResult {
  readonly nextState: EmotionalState;
  readonly explanationMetadata?: Readonly<Record<string, unknown>>;
  readonly confidenceAdjustment?: number;
}
