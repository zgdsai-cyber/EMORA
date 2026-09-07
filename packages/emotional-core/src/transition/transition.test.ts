import { describe, expect, it } from 'vitest';

import {
  createEmotionVector,
  createEmotionalDimensions,
  createEmotionalState,
  createEventSource,
  type StateTransitionProvider,
} from '../index';

describe('state transition contracts', () => {
  it('accepts a valid provider and returns a transition result', () => {
    const currentState = createEmotionalState({
      emotionVector: createEmotionVector({ joy: 0.2 }),
      dimensions: createEmotionalDimensions({
        valence: 0,
        arousal: 0.2,
        intensity: 0.2,
        confidence: 0.7,
      }),
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const provider: StateTransitionProvider = {
      identifier: 'test-provider',
      transition(input) {
        return {
          nextState: input.currentState,
          explanationMetadata: { deterministic: true },
          confidenceAdjustment: 0,
        };
      },
    };
    const result = provider.transition({
      currentState,
      event: {
        id: 'event-1',
        timestamp: '2026-01-01T00:00:01.000Z',
        source: createEventSource('test'),
        valence: 0,
        intensity: 0,
        relevance: 0,
        surprise: 0,
        uncertainty: 0,
      },
      personalityProfile: {
        id: 'profile-1',
        emotionalSensitivity: 0.5,
        baselineTrust: 0.5,
        baselineAnxiety: 0.5,
        attachmentSensitivity: 0.5,
        nostalgiaSensitivity: 0.5,
        jealousySensitivity: 0.5,
      },
    });

    expect(result.nextState).toBe(currentState);
    expect(result.explanationMetadata?.deterministic).toBe(true);
  });
});