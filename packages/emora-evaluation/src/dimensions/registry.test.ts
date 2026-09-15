import { describe, expect, it } from 'vitest';

import { emotionNames } from '@emora/emotional-core';

import {
  classifyDimension,
  DIMENSION_REGISTRY,
  EMOTION_DIMENSION_IDS,
  isBehavioralTarget,
  SPEARMAN_RANKING_PROTOCOL,
} from './registry';

describe('dimension registry (MDS v1.0 §3–§6)', () => {
  it('declares exactly the authorized dimensions with their semantic classes and ranges', () => {
    const byId = Object.fromEntries(DIMENSION_REGISTRY.map((definition) => [definition.dimensionId, definition]));
    expect(Object.keys(byId).sort()).toEqual([
      'anger', 'arousal', 'confidence', 'confidenceAdjustment', 'fear', 'intensity', 'jealousy', 'joy', 'love', 'nostalgia', 'trust', 'valence',
    ]);
    for (const emotion of EMOTION_DIMENSION_IDS) {
      expect(byId[emotion]).toMatchObject({ semanticClass: 'EMOTION', range: [0, 1], behavioralTarget: true });
    }
    expect(byId.valence).toMatchObject({ semanticClass: 'CONTINUOUS_AFFECT', range: [-1, 1], behavioralTarget: true });
    expect(byId.arousal).toMatchObject({ semanticClass: 'CONTINUOUS_AFFECT', range: [0, 1], behavioralTarget: true });
    expect(byId.intensity).toMatchObject({ semanticClass: 'CONTINUOUS_AFFECT', range: [0, 1], behavioralTarget: true });
    expect(byId.confidence).toMatchObject({ semanticClass: 'COMPUTATIONAL', behavioralTarget: false });
    expect(byId.confidenceAdjustment).toMatchObject({ semanticClass: 'COMPUTATIONAL', behavioralTarget: false });
  });

  it('matches the emotional-core emotion names without modifying emotional-core', () => {
    expect([...EMOTION_DIMENSION_IDS].sort()).toEqual([...emotionNames].sort());
  });

  it('excludes computational dimensions from behavioral targets and leaves unknown dimensions unclassified', () => {
    expect(isBehavioralTarget('joy')).toBe(true);
    expect(isBehavioralTarget('valence')).toBe(true);
    expect(isBehavioralTarget('confidence')).toBe(false);
    expect(isBehavioralTarget('confidenceAdjustment')).toBe(false);
    expect(isBehavioralTarget('serenity')).toBe(false);
    expect(classifyDimension('serenity')).toBeUndefined();
  });

  it('is immutable', () => {
    expect(Object.isFrozen(DIMENSION_REGISTRY)).toBe(true);
    expect(DIMENSION_REGISTRY.every((definition) => Object.isFrozen(definition) && Object.isFrozen(definition.range))).toBe(true);
    expect(Object.isFrozen(SPEARMAN_RANKING_PROTOCOL)).toBe(true);
  });

  it('declares the only authorized Spearman ranking protocol', () => {
    expect(SPEARMAN_RANKING_PROTOCOL).toMatchObject({
      rankingSpace: 'EMOTION',
      rankingConvention: 'RANK_1_IS_HIGHEST',
      referenceRepresentation: 'COMPETITION_RANKS',
      referenceTieTransformation: 'AVERAGE_RANK',
      modelScoreTransformation: 'FRACTIONAL_RANK',
      minimumN: 2,
    });
    expect([...SPEARMAN_RANKING_PROTOCOL.rankableDimensionIds]).toEqual([...EMOTION_DIMENSION_IDS]);
  });
});
