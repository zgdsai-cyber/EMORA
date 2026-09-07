import { describe, expect, it } from 'vitest';

import {
  createEmotionalState,
  createEmotionVector,
  createMLPrediction,
  DeterministicEmotionalDynamicsProvider,
  fuseHybridPrediction,
  WeightedHybridFusion,
} from '../index';
import type { StateTransitionResult } from '../index';

const deterministicState = createEmotionalState({
  emotionVector: createEmotionVector({ love: 0.2, trust: 0.3, joy: 0.4 }),
  dimensions: { valence: -0.2, arousal: 0.3, intensity: 0.4, confidence: 0.7 },
  timestamp: '2026-01-02T00:00:00.000Z',
});
const mlState = createEmotionalState({
  emotionVector: createEmotionVector({ love: 0.8, trust: 0.9, joy: 1 }),
  dimensions: { valence: 0.8, arousal: 0.9, intensity: 1, confidence: 0.6 },
  timestamp: '2026-01-02T00:00:00.000Z',
});
const deterministicPrediction: StateTransitionResult = {
  nextState: deterministicState,
  explanationMetadata: { source: 'deterministic' },
};
const mlPrediction = createMLPrediction({
  state: mlState,
  confidence: 0.5,
  modelIdentifier: 'future-ml-model',
  metadata: { experimental: true },
});

function fusion(alpha: number) {
  return fuseHybridPrediction({ deterministicPrediction, mlPrediction, alpha });
}

describe('hybrid learning foundation', () => {
  it('uses deterministic output at alpha = 1', () => {
    const result = fusion(1);
    expect(result.state.emotionVector).toEqual(deterministicState.emotionVector);
    expect(result.state.dimensions.valence).toBe(deterministicState.dimensions.valence);
    expect(result.confidence).toBe(deterministicState.dimensions.confidence);
  });

  it('uses ML output at alpha = 0 except confidence uses the ML prediction confidence', () => {
    const result = fusion(0);
    expect(result.state.emotionVector).toEqual(mlState.emotionVector);
    expect(result.state.dimensions.valence).toBe(mlState.dimensions.valence);
    expect(result.state.dimensions.confidence).toBe(mlState.dimensions.confidence);
    expect(result.confidence).toBe(mlPrediction.confidence);
  });

  it('averages state dimensions at alpha = 0.5', () => {
    const result = fusion(0.5);
    expect(result.state.emotionVector.love).toBeCloseTo(0.5);
    expect(result.state.dimensions.valence).toBeCloseTo(0.3);
    expect(result.state.dimensions.arousal).toBeCloseTo(0.6);
    expect(result.state.dimensions.confidence).toBeCloseTo(0.65);
    expect(result.confidence).toBeCloseTo(0.6);
  });

  it('rejects invalid alpha and non-finite ML confidence', () => {
    expect(() => fusion(-0.1)).toThrow();
    expect(() => fusion(1.1)).toThrow();
    expect(() => fusion(Number.NaN)).toThrow();
    expect(() => fusion(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => createMLPrediction({
      state: mlState,
      confidence: Number.NaN,
      modelIdentifier: 'invalid-model',
    })).toThrow();
  });

  it('returns immutable results and exposes a reusable fusion abstraction', () => {
    const result = new WeightedHybridFusion().fuse({ deterministicPrediction, mlPrediction, alpha: 0.5 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
    expect(result.metadata.mlModelIdentifier).toBe('future-ml-model');
    expect(new DeterministicEmotionalDynamicsProvider().identifier).toBe('deterministic-emotional-dynamics');
  });
});
