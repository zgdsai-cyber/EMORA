import { describe, expect, it } from 'vitest';

import {
  createEmotionVector,
  createEmotionalDimensions,
  createEventSource,
  createEmotionalState,
  InvalidDomainObjectError,
  InvalidDomainValueError,
  validateEmotionalEvent,
  validateEmotionalMemory,
  validatePersonalityProfile,
} from '../index';

const dimensions = createEmotionalDimensions({
  valence: 0.25,
  arousal: 0.5,
  intensity: 0.75,
  confidence: 0.8,
});

describe('domain validation', () => {
  it('validates event ranges and source values', () => {
    const event = {
      id: 'event-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      source: createEventSource('user-input'),
      valence: -1,
      intensity: 1,
      relevance: 0,
      surprise: 0.5,
      uncertainty: 0,
    } as const;

    expect(validateEmotionalEvent(event)).toBe(event);
    expect(() => createEventSource('')).toThrow(InvalidDomainObjectError);
    expect(() => validateEmotionalEvent({ ...event, uncertainty: 2 })).toThrow(InvalidDomainValueError);
  });

  it('validates extensible personality traits and memory ranges', () => {
    const profile = {
      id: 'profile-1',
      emotionalSensitivity: 0.5,
      baselineTrust: 0.5,
      baselineAnxiety: 0.5,
      attachmentSensitivity: 0.5,
      nostalgiaSensitivity: 0.5,
      jealousySensitivity: 0.5,
      additionalTraits: { openness: 0.7 },
    } as const;
    const state = createEmotionalState({
      emotionVector: createEmotionVector({ joy: 0.8 }),
      dimensions,
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.emotionVector)).toBe(true);
    expect(Object.isFrozen(state.dimensions)).toBe(true);
    expect(validatePersonalityProfile(profile)).toBe(profile);
    expect(() => validatePersonalityProfile({ ...profile, additionalTraits: { openness: 2 } })).toThrow(
      InvalidDomainValueError,
    );
    expect(validateEmotionalMemory({
      id: 'memory-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      emotionalState: state,
      intensity: 0.5,
      importance: 0.5,
      decayRate: 0.1,
    }).id).toBe('memory-1');
  });

  it('rejects invalid state timestamps and continuous dimensions', () => {
    expect(() => createEmotionalState({
      emotionVector: createEmotionVector(),
      dimensions,
      timestamp: 'not-a-date',
    })).toThrow(InvalidDomainObjectError);
    expect(() => createEmotionalDimensions({
      valence: -1.1,
      arousal: 0,
      intensity: 0,
      confidence: 0,
    })).toThrow(InvalidDomainValueError);
  });
});