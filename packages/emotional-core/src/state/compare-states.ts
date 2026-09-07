import { emotionVectorDistance } from '../math/vector';
import type { EmotionalState } from '../domain/emotional-state';
import { validateEmotionalState } from '../domain/emotional-state';

export interface EmotionalStateComparison {
  readonly emotionVectorDistance: number;
  readonly valenceDelta: number;
  readonly arousalDelta: number;
  readonly intensityDelta: number;
  readonly confidenceDelta: number;
}

export function compareEmotionalStates(
  left: EmotionalState,
  right: EmotionalState,
): EmotionalStateComparison {
  validateEmotionalState(left);
  validateEmotionalState(right);
  return {
    emotionVectorDistance: emotionVectorDistance(left.emotionVector, right.emotionVector),
    valenceDelta: right.dimensions.valence - left.dimensions.valence,
    arousalDelta: right.dimensions.arousal - left.dimensions.arousal,
    intensityDelta: right.dimensions.intensity - left.dimensions.intensity,
    confidenceDelta: right.dimensions.confidence - left.dimensions.confidence,
  };
}
