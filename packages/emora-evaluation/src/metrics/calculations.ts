import type { MetricResult } from '../contracts';

function isValidSeriesPair(
  observed: readonly number[],
  predicted: readonly number[],
  minSize = 1,
): { valid: true } | { valid: false; reason: string; insufficientData: boolean } {
  if (!Array.isArray(observed) || !Array.isArray(predicted)) {
    return { valid: false, reason: 'Inputs must be arrays of numbers.', insufficientData: false };
  }
  if (observed.length !== predicted.length) {
    return { valid: false, reason: `Series lengths mismatch (${observed.length} vs ${predicted.length}).`, insufficientData: false };
  }
  if (observed.length < minSize) {
    return { valid: false, reason: `Insufficient sample size (${observed.length} < ${minSize}).`, insufficientData: true };
  }
  for (let i = 0; i < observed.length; i++) {
    const o = observed[i];
    const p = predicted[i];
    if (typeof o !== 'number' || !Number.isFinite(o)) {
      return { valid: false, reason: `Observed value at index ${i} is non-finite or non-numeric.`, insufficientData: false };
    }
    if (typeof p !== 'number' || !Number.isFinite(p)) {
      return { valid: false, reason: `Predicted value at index ${i} is non-finite or non-numeric.`, insufficientData: false };
    }
  }
  return { valid: true };
}

function clampMinus1Plus1(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

export function calculateMAE(
  observed: readonly number[],
  predicted: readonly number[],
  dimension = 'value',
): MetricResult {
  const check = isValidSeriesPair(observed, predicted, 1);
  if (!check.valid) {
    return Object.freeze({
      metricId: 'MAE',
      dimension,
      value: Number.NaN,
      sampleSize: Array.isArray(observed) ? observed.length : 0,
      missingCasesCount: 0,
      status: check.insufficientData ? 'INSUFFICIENT_DATA' : 'INVALID',
      failureReason: check.reason,
    });
  }

  let totalError = 0;
  for (let i = 0; i < observed.length; i++) {
    totalError += Math.abs(observed[i] - predicted[i]);
  }

  return Object.freeze({
    metricId: 'MAE',
    dimension,
    value: totalError / observed.length,
    sampleSize: observed.length,
    missingCasesCount: 0,
    status: 'COMPUTED',
  });
}

export function calculateRMSE(
  observed: readonly number[],
  predicted: readonly number[],
  dimension = 'value',
): MetricResult {
  const check = isValidSeriesPair(observed, predicted, 1);
  if (!check.valid) {
    return Object.freeze({
      metricId: 'RMSE',
      dimension,
      value: Number.NaN,
      sampleSize: Array.isArray(observed) ? observed.length : 0,
      missingCasesCount: 0,
      status: check.insufficientData ? 'INSUFFICIENT_DATA' : 'INVALID',
      failureReason: check.reason,
    });
  }

  let totalSquaredError = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - predicted[i];
    totalSquaredError += diff * diff;
  }

  return Object.freeze({
    metricId: 'RMSE',
    dimension,
    value: Math.sqrt(totalSquaredError / observed.length),
    sampleSize: observed.length,
    missingCasesCount: 0,
    status: 'COMPUTED',
  });
}

export function calculatePearson(
  observed: readonly number[],
  predicted: readonly number[],
  dimension = 'value',
): MetricResult {
  const check = isValidSeriesPair(observed, predicted, 2);
  if (!check.valid) {
    return Object.freeze({
      metricId: 'PEARSON_R',
      dimension,
      value: Number.NaN,
      sampleSize: Array.isArray(observed) ? observed.length : 0,
      missingCasesCount: 0,
      status: check.insufficientData ? 'INSUFFICIENT_DATA' : 'INVALID',
      failureReason: check.reason,
    });
  }

  const n = observed.length;
  let sumObs = 0;
  let sumPred = 0;
  for (let i = 0; i < n; i++) {
    sumObs += observed[i];
    sumPred += predicted[i];
  }
  const meanObs = sumObs / n;
  const meanPred = sumPred / n;

  let sObsObs = 0;
  let sPredPred = 0;
  let sObsPred = 0;

  for (let i = 0; i < n; i++) {
    const diffObs = observed[i] - meanObs;
    const diffPred = predicted[i] - meanPred;
    sObsObs += diffObs * diffObs;
    sPredPred += diffPred * diffPred;
    sObsPred += diffObs * diffPred;
  }

  if (sObsObs === 0 || sPredPred === 0) {
    return Object.freeze({
      metricId: 'PEARSON_R',
      dimension,
      value: Number.NaN,
      sampleSize: n,
      missingCasesCount: 0,
      status: 'UNDEFINED',
      failureReason: 'Zero variance in observed or predicted series.',
    });
  }

  const r = clampMinus1Plus1(sObsPred / Math.sqrt(sObsObs * sPredPred));

  return Object.freeze({
    metricId: 'PEARSON_R',
    dimension,
    value: r,
    sampleSize: n,
    missingCasesCount: 0,
    status: 'COMPUTED',
  });
}

export function computeFractionalRanks(series: readonly number[]): number[] {
  const indexed = series.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(series.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].value === indexed[i].value) {
      j++;
    }
    // Ranks are 1-based: average rank for group from i to j-1
    const rankSum = ((i + 1) + j) * (j - i) / 2;
    const avgRank = rankSum / (j - i);
    for (let k = i; k < j; k++) {
      ranks[indexed[k].index] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/**
 * Competition-rank encoding (MDS v1.0 §6.2 A1, RANK_1_IS_HIGHEST): after sorting,
 * every distinct rank value equals 1 + the number of strictly lower ranks. Ties share
 * a rank and the following positions are skipped: [1,1,3] and [1,2,2,4] are valid;
 * [1,1,2], [1,2,2,3], [2,2,3] are not. Deterministic; does not mutate its input.
 */
export function isValidCompetitionRanking(ranks: readonly number[]): boolean {
  if (!Array.isArray(ranks) || ranks.length === 0) return false;
  if (ranks.some((rank) => typeof rank !== 'number' || !Number.isInteger(rank))) return false;
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;
    if (sorted[i] !== i + 1) return false;
  }
  return true;
}

/**
 * Spearman rho. Each side is converted once to fractional (average) ranks via
 * computeFractionalRanks: reference competition ranks become average ranks
 * ([1,1,3] -> [1.5,1.5,3]); model scores become fractional ranks (MDS v1.0 §6.3).
 */
export function calculateSpearman(
  observed: readonly number[],
  predicted: readonly number[],
  dimension = 'value',
): MetricResult {
  const check = isValidSeriesPair(observed, predicted, 2);
  if (!check.valid) {
    return Object.freeze({
      metricId: 'SPEARMAN_RHO',
      dimension,
      value: Number.NaN,
      sampleSize: Array.isArray(observed) ? observed.length : 0,
      missingCasesCount: 0,
      status: check.insufficientData ? 'INSUFFICIENT_DATA' : 'INVALID',
      failureReason: check.reason,
    });
  }

  const rankedObserved = computeFractionalRanks(observed);
  const rankedPredicted = computeFractionalRanks(predicted);

  const pearsonResult = calculatePearson(rankedObserved, rankedPredicted, dimension);
  if (pearsonResult.status !== 'COMPUTED') {
    return Object.freeze({
      metricId: 'SPEARMAN_RHO',
      dimension,
      value: Number.NaN,
      sampleSize: observed.length,
      missingCasesCount: 0,
      status: pearsonResult.status,
      failureReason: pearsonResult.failureReason ?? 'Rank correlation failed.',
    });
  }

  return Object.freeze({
    metricId: 'SPEARMAN_RHO',
    dimension,
    value: pearsonResult.value,
    sampleSize: observed.length,
    missingCasesCount: 0,
    status: 'COMPUTED',
  });
}

// Kendall tau is REMOVED from the Phase 6 roadmap by MDS v1.0 §5.5; no
// calculation function is authorized.

function getSign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function calculateDirectionalAccuracy(
  observedDeltas: readonly number[],
  predictedDeltas: readonly number[],
  dimension = 'value',
): MetricResult {
  const check = isValidSeriesPair(observedDeltas, predictedDeltas, 1);
  if (!check.valid) {
    return Object.freeze({
      metricId: 'DIRECTIONAL_ACCURACY',
      dimension,
      value: Number.NaN,
      sampleSize: Array.isArray(observedDeltas) ? observedDeltas.length : 0,
      missingCasesCount: 0,
      status: check.insufficientData ? 'INSUFFICIENT_DATA' : 'INVALID',
      failureReason: check.reason,
    });
  }

  let matches = 0;
  for (let i = 0; i < observedDeltas.length; i++) {
    if (getSign(observedDeltas[i]) === getSign(predictedDeltas[i])) {
      matches++;
    }
  }

  return Object.freeze({
    metricId: 'DIRECTIONAL_ACCURACY',
    dimension,
    value: matches / observedDeltas.length,
    sampleSize: observedDeltas.length,
    missingCasesCount: 0,
    status: 'COMPUTED',
  });
}

export function calculateVectorMAE(
  observedRecords: readonly Record<string, number>[],
  predictedRecords: readonly Record<string, number>[],
): MetricResult[] {
  if (!Array.isArray(observedRecords) || !Array.isArray(predictedRecords) || observedRecords.length !== predictedRecords.length) {
    return [
      Object.freeze({
        metricId: 'MAE',
        dimension: 'all',
        value: Number.NaN,
        sampleSize: 0,
        missingCasesCount: 0,
        status: 'INVALID',
        failureReason: 'Record lists must be non-null arrays of matching length.',
      }),
    ];
  }

  const dimensionsSet = new Set<string>();
  for (const record of observedRecords) {
    if (record && typeof record === 'object') {
      for (const key of Object.keys(record)) dimensionsSet.add(key);
    }
  }

  const dimensions = Array.from(dimensionsSet).sort();
  return dimensions.map((dim) => {
    const obsValues = observedRecords.map((r) => r[dim]);
    const predValues = predictedRecords.map((r) => r[dim]);
    return calculateMAE(obsValues, predValues, dim);
  });
}

export function calculateVectorRMSE(
  observedRecords: readonly Record<string, number>[],
  predictedRecords: readonly Record<string, number>[],
): MetricResult[] {
  if (!Array.isArray(observedRecords) || !Array.isArray(predictedRecords) || observedRecords.length !== predictedRecords.length) {
    return [
      Object.freeze({
        metricId: 'RMSE',
        dimension: 'all',
        value: Number.NaN,
        sampleSize: 0,
        missingCasesCount: 0,
        status: 'INVALID',
        failureReason: 'Record lists must be non-null arrays of matching length.',
      }),
    ];
  }

  const dimensionsSet = new Set<string>();
  for (const record of observedRecords) {
    if (record && typeof record === 'object') {
      for (const key of Object.keys(record)) dimensionsSet.add(key);
    }
  }

  const dimensions = Array.from(dimensionsSet).sort();
  return dimensions.map((dim) => {
    const obsValues = observedRecords.map((r) => r[dim]);
    const predValues = predictedRecords.map((r) => r[dim]);
    return calculateRMSE(obsValues, predValues, dim);
  });
}
