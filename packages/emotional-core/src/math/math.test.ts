import { describe, expect, it } from 'vitest';

import {
  addEmotionVectors,
  calculateDominantEmotion,
  clampEmotionVector,
  combineIndependentConfidence,
  createEmotionVector,
  emotionVectorDistance,
  mergeEmotionVectors,
  scaleEmotionVector,
  weightedConfidence,
  zeroEmotionVector,
} from '../index';

describe('emotion vector mathematics', () => {
  it('creates a zero vector and performs pure vector operations', () => {
    const zero = zeroEmotionVector();
    const left = createEmotionVector({ love: 0.2, joy: 0.4 });
    const right = createEmotionVector({ love: 0.4, joy: 0.6 });

    expect(zero.love).toBe(0);
    expect(addEmotionVectors(left, right).love).toBeCloseTo(0.6);
    expect(addEmotionVectors(left, right).joy).toBeCloseTo(1);
    expect(mergeEmotionVectors(left, right).love).toBeCloseTo(0.3);
    expect(mergeEmotionVectors(left, right).joy).toBeCloseTo(0.5);
    expect(scaleEmotionVector(right, 0.5).love).toBeCloseTo(0.2);
    expect(scaleEmotionVector(right, 0.5).joy).toBeCloseTo(0.3);
    expect(emotionVectorDistance(left, right)).toBeCloseTo(Math.sqrt(0.08));
  });

  it('clamps explicitly and handles dominant ties deterministically', () => {
    expect(clampEmotionVector({ love: -2, joy: 2 })).toEqual(createEmotionVector({ joy: 1 }));
    expect(calculateDominantEmotion(createEmotionVector({ love: 0.7, fear: 0.7 }))).toBe('love');
    expect(calculateDominantEmotion(zeroEmotionVector())).toBeNull();
    expect(() => addEmotionVectors(createEmotionVector({ love: 0.8 }), createEmotionVector({ love: 0.3 }))).toThrow();
    expect(() => scaleEmotionVector(createEmotionVector({ joy: 0.8 }), 2)).toThrow();
  });
});

describe('confidence mathematics', () => {
  it('combines independent and weighted confidence values', () => {
    expect(combineIndependentConfidence([0.8, 0.5])).toBeCloseTo(0.4);
    expect(weightedConfidence([
      { confidence: 0.2, weight: 1 },
      { confidence: 0.8, weight: 3 },
    ])).toBeCloseTo(0.65);
  });

  it('rejects empty and zero-weight aggregations', () => {
    expect(() => weightedConfidence([])).toThrow();
    expect(() => weightedConfidence([{ confidence: 0.5, weight: 0 }])).toThrow();
  });
});