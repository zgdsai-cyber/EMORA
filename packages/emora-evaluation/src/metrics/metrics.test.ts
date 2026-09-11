import { describe, expect, it } from 'vitest';

import {
  calculateDirectionalAccuracy,
  calculateMAE,
  calculatePearson,
  calculateRMSE,
  calculateSpearman,
  calculateVectorMAE,
  calculateVectorRMSE,
  computeFractionalRanks,
} from './calculations';
import {
  DIRECTIONAL_ACCURACY_DEFINITION,
  MAE_METRIC_DEFINITION,
  PEARSON_METRIC_DEFINITION,
  RMSE_METRIC_DEFINITION,
  SPEARMAN_METRIC_DEFINITION,
} from './definitions';

describe('L2-A metric definitions', () => {
  it('exposes immutable metric definitions with frozen lists', () => {
    expect(MAE_METRIC_DEFINITION.metricId).toBe('MAE');
    expect(RMSE_METRIC_DEFINITION.metricId).toBe('RMSE');
    expect(PEARSON_METRIC_DEFINITION.metricId).toBe('PEARSON_R');
    expect(SPEARMAN_METRIC_DEFINITION.metricId).toBe('SPEARMAN_RHO');
    expect(DIRECTIONAL_ACCURACY_DEFINITION.metricId).toBe('DIRECTIONAL_ACCURACY');

    expect(Object.isFrozen(MAE_METRIC_DEFINITION.assumptions)).toBe(true);
    expect(Object.isFrozen(SPEARMAN_METRIC_DEFINITION.assumptions)).toBe(true);
  });
});

describe('L2-A pure metric calculations - MAE', () => {
  it('calculates zero error when series are identical', () => {
    const result = calculateMAE([0.1, 0.5, 0.9], [0.1, 0.5, 0.9], 'joy');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(3);
    expect(result.dimension).toBe('joy');
  });

  it('calculates exact known simple error', () => {
    const result = calculateMAE([0.2, 0.8], [0.4, 0.5], 'trust');
    // |0.2 - 0.4| = 0.2, |0.8 - 0.5| = 0.3 => mean = 0.25
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeCloseTo(0.25);
  });

  it('handles negative valence values in [-1, 1]', () => {
    const result = calculateMAE([-0.5, 0.5], [0.5, -0.5], 'valence');
    // |-0.5 - 0.5| = 1.0, |0.5 - (-0.5)| = 1.0 => mean = 1.0
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeCloseTo(1.0);
  });

  it('fails on empty inputs or length mismatch without silent zero imputation', () => {
    const emptyResult = calculateMAE([], [], 'joy');
    expect(emptyResult.status).toBe('INSUFFICIENT_DATA');
    expect(Number.isNaN(emptyResult.value)).toBe(true);

    const mismatchResult = calculateMAE([0.1], [0.1, 0.2], 'joy');
    expect(mismatchResult.status).toBe('INVALID');
    expect(mismatchResult.failureReason).toContain('mismatch');
  });

  it('fails on non-finite or invalid numbers', () => {
    const nanResult = calculateMAE([0.1, Number.NaN], [0.1, 0.2], 'joy');
    expect(nanResult.status).toBe('INVALID');
    expect(nanResult.failureReason).toContain('non-finite');

    const infResult = calculateMAE([0.1, 0.2], [0.1, Number.POSITIVE_INFINITY], 'joy');
    expect(infResult.status).toBe('INVALID');
    expect(infResult.failureReason).toContain('non-finite');
  });
});

describe('L2-A pure metric calculations - RMSE', () => {
  it('calculates zero error when series are identical', () => {
    const result = calculateRMSE([0.3, 0.7], [0.3, 0.7], 'fear');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBe(0);
  });

  it('calculates exact known error and differs from MAE on non-uniform errors', () => {
    const observed = [0, 0];
    const predicted = [0, 2];
    const mae = calculateMAE(observed, predicted);
    const rmse = calculateRMSE(observed, predicted);

    // MAE = (0 + 2)/2 = 1.0
    // RMSE = sqrt((0^2 + 2^2)/2) = sqrt(2) ~ 1.4142
    expect(mae.value).toBeCloseTo(1.0);
    expect(rmse.value).toBeCloseTo(Math.sqrt(2));
    expect(rmse.value).not.toBe(mae.value);
  });

  it('fails gracefully on invalid inputs', () => {
    const result = calculateRMSE([0.1], [Number.NaN]);
    expect(result.status).toBe('INVALID');
    expect(Number.isNaN(result.value)).toBe(true);
  });
});

describe('L2-A pure metric calculations - Pearson Correlation', () => {
  it('calculates perfect positive correlation', () => {
    const result = calculatePearson([0.1, 0.5, 0.9], [0.2, 0.6, 1.0], 'joy');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeCloseTo(1.0);
  });

  it('calculates perfect negative correlation', () => {
    const result = calculatePearson([0.1, 0.5, 0.9], [0.9, 0.5, 0.1], 'joy');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeCloseTo(-1.0);
  });

  it('returns INVALID when variance is zero in one or both series', () => {
    const result = calculatePearson([0.5, 0.5, 0.5], [0.1, 0.5, 0.9], 'joy');
    expect(result.status).toBe('INVALID');
    expect(result.failureReason).toContain('Zero variance');
  });

  it('returns INSUFFICIENT_DATA when sample size is less than 2', () => {
    const result = calculatePearson([0.5], [0.5]);
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });
});

describe('L2-A pure metric calculations - Fractional Ranks & Spearman', () => {
  it('computes fractional ranks correctly with ties', () => {
    // Values 0.2, 0.5, 0.5, 0.9 => ranks 1, 2.5, 2.5, 4
    const ranks = computeFractionalRanks([0.2, 0.5, 0.5, 0.9]);
    expect(ranks).toEqual([1, 2.5, 2.5, 4]);
  });

  it('calculates Spearman rho for identical rank order', () => {
    const result = calculateSpearman([0.1, 0.8, 0.3], [0.2, 0.9, 0.4], 'anger');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeCloseTo(1.0);
  });

  it('calculates Spearman rho for inverse rank order', () => {
    const result = calculateSpearman([0.1, 0.8, 0.3], [0.9, 0.2, 0.4], 'anger');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeCloseTo(-1.0);
  });

  it('handles tied ranks properly', () => {
    const result = calculateSpearman([0.1, 0.5, 0.5, 0.9], [0.1, 0.4, 0.6, 0.9], 'anger');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBeGreaterThan(0.9);
  });

  it('returns INVALID when all values are tied (zero rank variance)', () => {
    const result = calculateSpearman([0.5, 0.5, 0.5], [0.1, 0.2, 0.3]);
    expect(result.status).toBe('INVALID');
  });
});

describe('L2-A pure metric calculations - Directional Accuracy', () => {
  it('calculates 1.0 accuracy when signs match exactly', () => {
    const observedDeltas = [0.2, -0.5, 0.0];
    const predictedDeltas = [0.1, -0.1, 0.0];
    const result = calculateDirectionalAccuracy(observedDeltas, predictedDeltas, 'joy');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBe(1.0);
  });

  it('calculates 0.0 accuracy when signs are completely opposite', () => {
    const observedDeltas = [0.2, -0.5];
    const predictedDeltas = [-0.1, 0.1];
    const result = calculateDirectionalAccuracy(observedDeltas, predictedDeltas, 'joy');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBe(0.0);
  });

  it('handles partial sign matches', () => {
    const observedDeltas = [0.2, -0.5, 0.3, -0.1];
    const predictedDeltas = [0.1, -0.1, -0.2, -0.4]; // Matches at idx 0, 1, 3 (3/4 = 0.75)
    const result = calculateDirectionalAccuracy(observedDeltas, predictedDeltas, 'joy');
    expect(result.status).toBe('COMPUTED');
    expect(result.value).toBe(0.75);
  });
});

describe('L2-A vector calculation helpers', () => {
  it('calculates MAE per dimension without aggregate overall score', () => {
    const obs = [{ joy: 0.2, fear: 0.8 }, { joy: 0.4, fear: 0.6 }];
    const pred = [{ joy: 0.3, fear: 0.7 }, { joy: 0.5, fear: 0.5 }];

    const results = calculateVectorMAE(obs, pred);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.dimension)).toEqual(['fear', 'joy']);
    expect(results.find((r) => r.dimension === 'joy')?.value).toBeCloseTo(0.1);
    expect(results.find((r) => r.dimension === 'fear')?.value).toBeCloseTo(0.1);
  });

  it('calculates RMSE per dimension without aggregate overall score', () => {
    const obs = [{ joy: 0.0, fear: 0.0 }, { joy: 0.0, fear: 0.0 }];
    const pred = [{ joy: 0.0, fear: 2.0 }, { joy: 0.0, fear: 0.0 }];

    const results = calculateVectorRMSE(obs, pred);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.dimension === 'joy')?.value).toBe(0);
    expect(results.find((r) => r.dimension === 'fear')?.value).toBeCloseTo(Math.sqrt(2));
  });
});
