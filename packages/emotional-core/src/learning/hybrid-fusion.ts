import { createEmotionalState, validateEmotionalState } from '../domain/emotional-state';
import { emotionNames } from '../domain/emotion-vector';
import { clamp01, clampSignedNormalized, validateNormalized01 } from '../math/ranges';
import type { EmotionVector } from '../domain/emotion-vector';
import type { StateTransitionResult } from '../transition/transition-types';
import type { MLEmotionalStatePrediction } from './ml-provider';
import { validateMLPrediction } from './ml-provider';
import type { EmotionalState } from '../domain/emotional-state';

export interface HybridFusionInput {
  readonly deterministicPrediction: StateTransitionResult;
  readonly mlPrediction: MLEmotionalStatePrediction;
  readonly alpha: number;
}

export interface HybridEmotionalStatePrediction {
  readonly state: EmotionalState;
  readonly confidence: number;
  readonly alpha: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface HybridFusion {
  readonly identifier: string;
  fuse(input: HybridFusionInput): HybridEmotionalStatePrediction;
}

function weightedDeterministicValue(deterministic: number, ml: number, alpha: number) {
  return alpha * deterministic + (1 - alpha) * ml;
}

export function fuseHybridPrediction(
  input: HybridFusionInput,
): HybridEmotionalStatePrediction {
  validateNormalized01(input.alpha, 'fusion.alpha');
  validateEmotionalState(input.deterministicPrediction.nextState);
  validateMLPrediction(input.mlPrediction);

  const deterministicState = input.deterministicPrediction.nextState;
  const mlState = input.mlPrediction.state;
  const emotionVector = Object.fromEntries(
    emotionNames.map((emotion) => [
      emotion,
      clamp01(
        weightedDeterministicValue(
          deterministicState.emotionVector[emotion],
          mlState.emotionVector[emotion],
          input.alpha,
        ),
        `hybrid.emotion.${emotion}`,
      ),
    ]),
  ) as EmotionVector;
  const confidence = clamp01(
    weightedDeterministicValue(
      deterministicState.dimensions.confidence,
      input.mlPrediction.confidence,
      input.alpha,
    ),
    'hybrid.confidence',
  );
  const state = createEmotionalState({
    emotionVector,
    dimensions: {
      valence: clampSignedNormalized(
        weightedDeterministicValue(
          deterministicState.dimensions.valence,
          mlState.dimensions.valence,
          input.alpha,
        ),
        'hybrid.valence',
      ),
      arousal: clamp01(
        weightedDeterministicValue(
          deterministicState.dimensions.arousal,
          mlState.dimensions.arousal,
          input.alpha,
        ),
        'hybrid.arousal',
      ),
      intensity: clamp01(
        weightedDeterministicValue(
          deterministicState.dimensions.intensity,
          mlState.dimensions.intensity,
          input.alpha,
        ),
        'hybrid.intensity',
      ),
      confidence: clamp01(
        weightedDeterministicValue(
          deterministicState.dimensions.confidence,
          mlState.dimensions.confidence,
          input.alpha,
        ),
        'hybrid.stateConfidence',
      ),
    },
    timestamp: deterministicState.timestamp,
    modelVersion: input.alpha === 0
      ? mlState.modelVersion
      : deterministicState.modelVersion ?? mlState.modelVersion,
    metadata: {
      ...deterministicState.metadata,
      ...mlState.metadata,
      hybridFusion: true,
    },
  });

  return Object.freeze({
    state,
    confidence,
    alpha: input.alpha,
    metadata: Object.freeze({
      deterministicModelVersion: deterministicState.modelVersion,
      mlModelIdentifier: input.mlPrediction.modelIdentifier,
      mlModelVersion: input.mlPrediction.modelVersion,
    }),
  });
}

export class WeightedHybridFusion implements HybridFusion {
  readonly identifier = 'weighted-hybrid-fusion';

  fuse(input: HybridFusionInput): HybridEmotionalStatePrediction {
    return fuseHybridPrediction(input);
  }
}
