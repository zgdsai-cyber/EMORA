import { describe, expect, it } from 'vitest';

import type { StateTransitionInput } from '@emora/emotional-core';

import { createConstantBaselineProvider } from './baselines';
import type {
  ConstantBaselineDefinition,
  DeterministicAblationDefinition,
} from './contracts';

const constantDefinition: ConstantBaselineDefinition = {
  baselineId: 'constant-midpoint',
  baselineVersion: '1.0.0',
  kind: 'CONSTANT',
  values: {
    love: 0.5,
    fear: 0.5,
    nostalgia: 0.5,
    jealousy: 0.5,
    trust: 0.5,
    anger: 0.5,
    joy: 0.5,
    valence: 0,
    arousal: 0.5,
    intensity: 0.5,
  },
};

const input = {
  currentState: {
    emotionVector: {
      love: 0,
      fear: 0,
      nostalgia: 0,
      jealousy: 0,
      trust: 0,
      anger: 0,
      joy: 0,
    },
    dimensions: { valence: 0, arousal: 0, intensity: 0, confidence: 0.8 },
    timestamp: '2026-01-01T00:00:00.000Z',
  },
  event: {
    id: 'baseline-event',
    timestamp: '2026-01-01T00:01:00.000Z',
    source: 'baseline-test',
    valence: 0.5,
    intensity: 0.5,
    relevance: 0.5,
    surprise: 0.5,
    uncertainty: 0.5,
  },
  personalityProfile: {
    id: 'baseline-profile',
    emotionalSensitivity: 0.5,
    baselineTrust: 0.5,
    baselineAnxiety: 0.5,
    attachmentSensitivity: 0.5,
    nostalgiaSensitivity: 0.5,
    jealousySensitivity: 0.5,
  },
} as unknown as StateTransitionInput;

describe('Phase 6.9 baselines', () => {
  it('produces a deterministic constant output within declared bounds', () => {
    const provider = createConstantBaselineProvider(constantDefinition);
    const first = provider.transition(input);
    const second = provider.transition(input);

    expect(first).toEqual(second);
    expect(first.nextState.emotionVector.joy).toBe(0.5);
    expect(first.nextState.dimensions.valence).toBe(0);
    expect(provider.identifier).toBe('baseline:constant-midpoint');
  });

  it('rejects incomplete or out-of-range constants without fitting from data', () => {
    expect(() =>
      createConstantBaselineProvider({
        ...constantDefinition,
        values: { ...constantDefinition.values, joy: 2 },
      }),
    ).toThrow();
    expect(() =>
      createConstantBaselineProvider({
        ...constantDefinition,
        values: { ...constantDefinition.values, confidence: 0.5 },
      }),
    ).toThrow();
  });

  it.each([
    'ZERO_INTERACTION_WEIGHTS',
    'ZERO_PERSONALITY_SENSITIVITY_WEIGHTS',
  ] as const)(
    'limits ablation contracts to approved finite kinds: %s',
    (ablation) => {
      const definition: DeterministicAblationDefinition = {
        baselineId: `ablation-${ablation}`,
        baselineVersion: '1.0.0',
        kind: 'DETERMINISTIC_ABLATION',
        parameterVersionId: 'caller-governed-version-id',
        parameterVersionHash: 'caller-governed-version-hash',
        ablation,
      };

      expect(definition.ablation).toBe(ablation);
      expect(definition.parameterVersionId).toBe('caller-governed-version-id');
    },
  );
});
