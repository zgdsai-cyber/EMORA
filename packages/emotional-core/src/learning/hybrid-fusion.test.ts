import { describe, expect, it } from 'vitest';

import {
  createEmotionalState,
  createEmotionVector,
  createMLPrediction,
  createModelVersion,
  DeterministicEmotionalDynamicsProvider,
  fuseHybridPrediction,
  WeightedHybridFusion,
} from '../index';
import type { StateTransitionResult } from '../index';

const deterministicState = createEmotionalState({
  emotionVector: createEmotionVector({ love: 0.2, trust: 0.3, joy: 0.4 }),
  dimensions: { valence: -0.2, arousal: 0.3, intensity: 0.4, confidence: 0.7 },
  timestamp: '2026-01-02T00:00:00.000Z',
  modelVersion: createModelVersion({ id: 'deterministic', name: 'Deterministic', version: '5.0.0' }),
  metadata: { source: 'deterministic', nested: { score: 1 } },
});
const mlState = createEmotionalState({
  emotionVector: createEmotionVector({ love: 0.8, trust: 0.9, joy: 1 }),
  dimensions: { valence: 0.8, arousal: 0.9, intensity: 1, confidence: 0.6 },
  timestamp: '2026-01-03T00:00:00.000Z',
  modelVersion: createModelVersion({ id: 'ml', name: 'ML', version: '6.1.0' }),
  metadata: { source: 'ml', nested: { score: 2 } },
});
const deterministicPrediction: StateTransitionResult = {
  nextState: deterministicState,
  explanationMetadata: { source: 'deterministic' },
};
const mlPrediction = createMLPrediction({
  state: mlState,
  confidence: 0.5,
  modelIdentifier: 'future-ml-model',
  metadata: { experimental: true, nested: { score: 3 }, items: [{ value: 1 }] },
});

function fusion(alpha: number) {
  return fuseHybridPrediction({ deterministicPrediction, mlPrediction, alpha });
}

describe('hybrid learning foundation', () => {
  it('uses deterministic output at alpha = 1', () => {
    const before = JSON.stringify(deterministicState);
    const result = fusion(1);
    expect(result.state.emotionVector).toEqual(deterministicState.emotionVector);
    expect(result.state.dimensions).toEqual(deterministicState.dimensions);
    expect(result.state.dimensions.valence).toBe(deterministicState.dimensions.valence);
    expect(result.state.timestamp).toBe(deterministicState.timestamp);
    expect(result.state.modelVersion).toEqual(deterministicState.modelVersion);
    expect(result.state.metadata).toEqual(deterministicState.metadata);
    expect(result.metadata).toEqual(deterministicState.metadata);
    expect(result.metadata).not.toHaveProperty('mlModelIdentifier');
    expect(result.metadata).not.toHaveProperty('fusion');
    expect(result.confidence).toBe(deterministicState.dimensions.confidence);
    expect(JSON.stringify(deterministicState)).toBe(before);
  });

  it('uses ML output at alpha = 0 except confidence uses the ML prediction confidence', () => {
    const before = JSON.stringify(mlState);
    const result = fusion(0);
    expect(result.state.emotionVector).toEqual(mlState.emotionVector);
    expect(result.state.dimensions).toEqual(mlState.dimensions);
    expect(result.state.dimensions.valence).toBe(mlState.dimensions.valence);
    expect(result.state.dimensions.confidence).toBe(mlState.dimensions.confidence);
    expect(result.state.timestamp).toBe(mlState.timestamp);
    expect(result.state.modelVersion).toEqual(mlState.modelVersion);
    expect(result.state.metadata).toEqual(mlState.metadata);
    expect(result.metadata).toEqual(mlPrediction.metadata);
    expect(result.metadata).not.toHaveProperty('deterministicModelVersion');
    expect(result.metadata).not.toHaveProperty('fusion');
    expect(result.confidence).toBe(mlPrediction.confidence);
    expect(JSON.stringify(mlState)).toBe(before);
  });

  it('averages state dimensions at alpha = 0.5', () => {
    const result = fusion(0.5);
    expect(result.state.emotionVector.love).toBeCloseTo(0.5);
    expect(result.state.dimensions.valence).toBeCloseTo(0.3);
    expect(result.state.dimensions.arousal).toBeCloseTo(0.6);
    expect(result.state.dimensions.confidence).toBeCloseTo(0.65);
    expect(result.confidence).toBeCloseTo(0.6);
    expect(result.state.timestamp).toBe(deterministicState.timestamp);
    expect(result.state.modelVersion).toEqual(deterministicState.modelVersion);
    expect(result.state.metadata).toEqual({
      deterministic: deterministicState.metadata,
      ml: mlState.metadata,
      fusion: { alpha: 0.5 },
    });
    expect(result.metadata).toEqual({
      deterministic: deterministicState.metadata,
      ml: mlPrediction.metadata,
      fusion: { alpha: 0.5 },
    });
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
    expect(Object.isFrozen(result.state.metadata)).toBe(true);
    expect(Object.isFrozen((result.state.metadata as { ml: unknown }).ml)).toBe(true);
    expect(result.metadata.fusion).toEqual({ alpha: 0.5 });
    expect(new DeterministicEmotionalDynamicsProvider().identifier).toBe('deterministic-emotional-dynamics');
  });

  it('deep-copies external ML metadata and rejects nested result mutation', () => {
    const externalMetadata = {
      nested: { score: 10 },
      items: [{ value: 20 }],
    };
    const prediction = createMLPrediction({
      state: mlState,
      confidence: 0.5,
      modelIdentifier: 'external-model',
      metadata: externalMetadata,
    });

    externalMetadata.nested.score = 99;
    externalMetadata.items[0].value = 99;
    expect((prediction.metadata as typeof externalMetadata).nested.score).toBe(10);
    expect((prediction.metadata as typeof externalMetadata).items[0].value).toBe(20);

    const result = fusion(0.5);
    const resultMetadata = result.state.metadata as {
      ml: { nested: { score: number } };
    };
    expect(() => {
      resultMetadata.ml.nested.score = 99;
    }).toThrow();
    expect(resultMetadata.ml.nested.score).toBe(2);
  });

  it('rejects unsupported metadata values instead of erasing them', () => {
    expect(() => createMLPrediction({
      state: mlState,
      confidence: 0.5,
      modelIdentifier: 'date-model',
      metadata: { generatedAt: new Date('2026-01-01T00:00:00.000Z') },
    })).toThrow(/plain objects and arrays/);

    expect(() => createMLPrediction({
      state: mlState,
      confidence: 0.5,
      modelIdentifier: 'map-model',
      metadata: { values: new Map([['key', 'value']]) },
    })).toThrow(/plain objects and arrays/);
  });
});
