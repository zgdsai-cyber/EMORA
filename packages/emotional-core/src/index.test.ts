import { describe, expect, it } from 'vitest';

import type { EmotionVector } from './index';

describe('emotional-core contracts', () => {
  it('exposes normalized emotional dimensions as typed contracts', () => {
    const vector: EmotionVector = {
      love: 0.5,
      fear: 0,
      nostalgia: 0,
      jealousy: 0,
      trust: 0.8,
      anger: 0,
      joy: 0.7,
      valence: 0.6,
      arousal: 0.4,
      intensity: 0.5,
      confidence: 0.9,
    };

    expect(vector.confidence).toBeGreaterThanOrEqual(0);
    expect(vector.confidence).toBeLessThanOrEqual(1);
  });
});
