import { describe, expect, it } from 'vitest';

import {
  clamp01,
  normalize01,
  validateNormalized01,
  validateSignedNormalized,
} from '../index';

describe('numeric ranges', () => {
  it('accepts inclusive boundaries and interior values', () => {
    expect(normalize01(0)).toBe(0);
    expect(normalize01(0.5)).toBe(0.5);
    expect(normalize01(1)).toBe(1);
    expect(validateSignedNormalized(-1)).toBe(-1);
    expect(validateSignedNormalized(1)).toBe(1);
  });

  it('rejects invalid finite and non-finite values', () => {
    for (const value of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => validateNormalized01(value)).toThrow();
    }
    expect(() => validateSignedNormalized(-1.01)).toThrow();
    expect(() => validateSignedNormalized(1.01)).toThrow();
  });

  it('only clamps through the explicit clamp function', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(() => clamp01(Number.NaN)).toThrow();
  });
});