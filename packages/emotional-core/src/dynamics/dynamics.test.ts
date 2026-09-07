import { describe, expect, it } from 'vitest';

import {
  applyEmotionInteractions,
  applyTemporalStability,
  calculateBaseEmotionInfluence,
  calculateEventImpact,
  calculateMemoryStrength,
  calculateMemoryInfluence,
  calculateNextEmotionalState,
  createDefaultModelParameters,
  createEmotionVector,
  createEmotionalState,
  createEventSource,
  createPersonalityProfile,
  DeterministicEmotionalDynamicsProvider,
  extractEventFeatures,
  validateModelParameters,
} from '../index';
import type { EmotionalMemory } from '../index';
import type { ModelParameters } from '../index';

const profile = createPersonalityProfile({
  id: 'profile-1',
  emotionalSensitivity: 0.8,
  baselineTrust: 0.6,
  baselineAnxiety: 0.4,
  attachmentSensitivity: 0.7,
  nostalgiaSensitivity: 0.6,
  jealousySensitivity: 0.7,
});
const state = createEmotionalState({
  emotionVector: createEmotionVector({ trust: 0.5, joy: 0.2 }),
  dimensions: { valence: 0, arousal: 0.2, intensity: 0.2, confidence: 0.8 },
  timestamp: '2026-01-01T00:00:00.000Z',
});
const positiveEvent = {
  id: 'event-positive', timestamp: '2026-01-02T00:00:00.000Z', source: createEventSource('test'),
  valence: 0.9, intensity: 1, relevance: 1, surprise: 0.5, uncertainty: 0.1,
} as const;
const negativeEvent = { ...positiveEvent, id: 'event-negative', valence: -0.9, uncertainty: 0.8 } as const;

function transition(event: typeof positiveEvent | typeof negativeEvent = positiveEvent, memories: readonly EmotionalMemory[] = []) {
  return calculateNextEmotionalState({ currentState: state, event, personalityProfile: profile, memories });
}

describe('deterministic emotional dynamics', () => {
  it('extracts features and applies the documented impact formula', () => {
    expect(extractEventFeatures(positiveEvent).valence).toBe(0.9);
    expect(calculateEventImpact(positiveEvent)).toBeCloseTo(0.75);
    expect(calculateBaseEmotionInfluence(extractEventFeatures(positiveEvent), 0.75).joy).toBeGreaterThan(0);
    expect(calculateBaseEmotionInfluence(extractEventFeatures(negativeEvent), 0.75).fear).toBeGreaterThan(0);
  });

  it('is deterministic and returns explainability metadata', () => {
    const first = transition();
    const second = transition();
    expect(first).toEqual(second);
    expect(first.explanationMetadata).toEqual(expect.objectContaining({
      eventImpact: expect.any(Number),
      personalityModifiers: expect.any(Object),
      baseInfluence: expect.any(Object),
      interactionInfluence: expect.any(Object),
      memoryInfluence: expect.any(Object),
      stabilityInfluence: expect.any(Object),
      confidenceFactors: expect.any(Object),
    }));
  });

  it('responds directionally to positive, negative, and uncertain events', () => {
    const positive = transition(positiveEvent).nextState;
    const negative = transition(negativeEvent).nextState;
    expect(positive.emotionVector.joy).toBeGreaterThan(state.emotionVector.joy);
    expect(positive.emotionVector.trust).toBeGreaterThan(state.emotionVector.trust);
    expect(negative.emotionVector.fear).toBeGreaterThan(state.emotionVector.fear);
    expect(negative.emotionVector.jealousy).toBeGreaterThan(state.emotionVector.jealousy);
    expect(negative.emotionVector.trust).toBeLessThanOrEqual(state.emotionVector.trust);
  });

  it('applies personality, interactions, memory, and temporal stability', () => {
    const lowSensitivity = createPersonalityProfile({
      ...profile,
      id: 'profile-low',
      emotionalSensitivity: 0,
      attachmentSensitivity: 0,
    });
    const sensitive = calculateNextEmotionalState({
      currentState: state,
      event: positiveEvent,
      personalityProfile: profile,
    });
    const low = calculateNextEmotionalState({
      currentState: state,
      event: positiveEvent,
      personalityProfile: lowSensitivity,
    });
    expect(sensitive.nextState.emotionVector.joy).toBeGreaterThan(low.nextState.emotionVector.joy);
    expect(applyEmotionInteractions(createEmotionVector({ fear: 1 })).trust).toBeLessThan(0);
    expect(calculateMemoryStrength({
      id: 'memory', timestamp: '2026-01-01T23:00:00.000Z', emotionalState: state,
      intensity: 1, importance: 1, decayRate: 0,
    }, positiveEvent.timestamp)).toBe(1);
    const recentMemory: EmotionalMemory = {
      id: 'recent',
      timestamp: '2026-01-01T23:00:00.000Z',
      emotionalState: createEmotionalState({
        emotionVector: createEmotionVector({ joy: 1 }),
        dimensions: state.dimensions,
        timestamp: '2026-01-01T23:00:00.000Z',
      }),
      intensity: 1,
      importance: 1,
      decayRate: 0,
    };
    const oldMemory: EmotionalMemory = {
      ...recentMemory,
      id: 'old',
      timestamp: '2025-01-01T00:00:00.000Z',
      decayRate: 1,
    };
    expect(calculateMemoryInfluence([recentMemory], state.emotionVector, positiveEvent.timestamp).joy).toBeGreaterThan(0);
    expect(calculateMemoryInfluence([oldMemory], state.emotionVector, positiveEvent.timestamp).joy).toBeCloseTo(0);
    expect(applyTemporalStability(createEmotionVector({ joy: 1 }), createEmotionVector(), createDefaultModelParameters()).joy).toBeLessThan(1);
  });

  it('ignores future memories and rejects invalid parameter values', () => {
    expect(calculateMemoryStrength({
      id: 'future', timestamp: '2026-01-03T00:00:00.000Z', emotionalState: state,
      intensity: 1, importance: 1, decayRate: 0,
    }, positiveEvent.timestamp)).toBe(0);
    expect(() => validateModelParameters({
      sets: {}, dynamics: { ...createDefaultModelParameters().dynamics, confidenceWeights: { ...createDefaultModelParameters().dynamics.confidenceWeights, base: Number.NaN } },
    })).toThrow();
  });

  it('provides the StateTransitionProvider implementation and immutable output', () => {
    const provider = new DeterministicEmotionalDynamicsProvider();
    const before = JSON.stringify(state);
    const result = provider.transition({ currentState: state, event: positiveEvent, personalityProfile: profile });
    expect(provider.identifier).toBe('deterministic-emotional-dynamics');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nextState)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    for (const value of Object.values(result.nextState.emotionVector)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(result.nextState.dimensions.valence).toBeGreaterThanOrEqual(-1);
    expect(result.nextState.dimensions.valence).toBeLessThanOrEqual(1);
    expect(result.nextState.dimensions.arousal).toBeLessThanOrEqual(1);
    expect(result.nextState.dimensions.intensity).toBeLessThanOrEqual(1);
    expect(result.nextState.dimensions.confidence).toBeLessThanOrEqual(1);
  });

  it('rejects a custom trust.negative coefficient instead of allowing inversion', () => {
    const defaults = createDefaultModelParameters();
    const malicious = {
      ...defaults,
      dynamics: {
        ...defaults.dynamics,
        emotionWeights: {
          ...defaults.dynamics.emotionWeights,
          trust: { ...defaults.dynamics.emotionWeights.trust, negative: 2 },
        },
      },
    } as unknown as ModelParameters;

    expect(() => validateModelParameters(malicious)).toThrow();
  });
});
