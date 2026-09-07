import { describe, expect, it } from 'vitest';

import {
  createEmotionVector,
  createEmotionalDimensions,
  InvalidDomainValueError,
} from './index';

describe('emotional-core contracts', () => {
  it('exposes normalized emotional dimensions as typed contracts', () => {
    const vector = createEmotionVector({ love: 0.5, trust: 0.8, joy: 0.7 });
    const dimensions = createEmotionalDimensions({
      valence: 0.6,
      arousal: 0.4,
      intensity: 0.5,
      confidence: 0.9,
    });

    expect(vector.joy).toBe(0.7);
    expect(dimensions.confidence).toBe(0.9);
  });

  it('rejects invalid values at runtime', () => {
    expect(() => createEmotionVector({ fear: Number.NaN })).toThrow(InvalidDomainValueError);
    expect(() => createEmotionalDimensions({ valence: 2, arousal: 0, intensity: 0, confidence: 0 })).toThrow(
      InvalidDomainValueError,
    );
  });
});
