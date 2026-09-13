import { describe, expect, it } from 'vitest';

import type { StateTransitionProvider } from '@emora/emotional-core';

import type { EvaluationRequest } from '../contracts';
import { runBehavioralEvaluation } from './runner';

const executionMetadata = {
  runId: 'run-fixed-001',
  executionTimestamp: '2026-09-12T00:00:00.000Z',
};

function validResult(joy: number, fear: number, confidence = 0.8) {
  return {
    nextState: {
      emotionVector: { joy, fear },
      dimensions: { valence: joy - fear, arousal: joy, intensity: joy, confidence },
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    confidenceAdjustment: 0,
  };
}

function provider(
  transition: StateTransitionProvider['transition'],
): StateTransitionProvider {
  return {
    identifier: 'fake-provider',
    modelVersion: { id: 'fake', name: 'Fake Provider', version: '1.0.0' },
    transition,
  };
}

function request(
  evaluationCases: EvaluationRequest['dataset']['cases'],
  transition: StateTransitionProvider['transition'],
): EvaluationRequest {
  return {
    dataset: {
      datasetId: 'synthetic-metrics-fixture',
      datasetVersion: '1.0.0',
      datasetHash: 'dataset-hash-supplied-by-caller',
      referenceType: 'SYNTHETIC_ORACLE',
      title: 'Software metric fixture',
      description: 'Synthetic fixture for runner behavior only.',
      casesCount: evaluationCases.length,
      cases: evaluationCases,
      provenanceMetadata: {},
    },
    engine: {
      provider: provider(transition),
      runtimeContract: 'node-22-test-contract',
      engineVersion: '1.0.0',
      engineCommit: 'engine-commit-supplied-by-caller',
    },
    parameterVersionId: 'opaque-parameter-version',
    parameterVersionHash: 'opaque-parameter-hash',
    evaluationContractVersion: 'l2-b-v1',
    configurationHash: 'configuration-hash-supplied-by-caller',
  };
}

function exactCase(caseId: string, joyTarget: number, fearTarget: number) {
  return {
    caseId,
    datasetId: 'synthetic-metrics-fixture',
    input: { caseId },
    referenceAnnotation: {
      annotationType: 'EXACT_VECTOR' as const,
      targetValues: { joy: joyTarget, fear: fearTarget },
    },
  };
}

function allMetricResults(run: ReturnType<typeof runBehavioralEvaluation>) {
  return [
    ...run.caseResults.flatMap((result) => result.metricResults),
    ...(run.runLevelMetricResults ?? []),
  ];
}

describe('runBehavioralEvaluation', () => {
  it('preserves dataset/engine/parameter/contract provenance', () => {
    const run = runBehavioralEvaluation(
      request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never),
      executionMetadata,
    );

    expect(run.datasetIdentity).toEqual({
      datasetId: 'synthetic-metrics-fixture',
      datasetVersion: '1.0.0',
      datasetHash: 'dataset-hash-supplied-by-caller',
    });
    expect(run.engineIdentity).toEqual({
      engineVersion: '1.0.0',
      engineCommit: 'engine-commit-supplied-by-caller',
      runtimeContract: 'node-22-test-contract',
    });
    expect(run.parameterVersionId).toBe('opaque-parameter-version');
    expect(run.parameterVersionHash).toBe('opaque-parameter-hash');
    expect(run.evaluationContractVersion).toBe('l2-b-v1');
    expect(run.configurationHash).toBe('configuration-hash-supplied-by-caller');
    expect(run.executionTimestamp).toBe(executionMetadata.executionTimestamp);
  });

  it('is deterministic when request and execution metadata are unchanged', () => {
    const evaluationRequest = request(
      [exactCase('case-1', 0.7, 0.2)],
      () => validResult(0.7, 0.2) as never,
    );

    expect(runBehavioralEvaluation(evaluationRequest, executionMetadata))
      .toEqual(runBehavioralEvaluation(evaluationRequest, executionMetadata));
  });

  it('returns an immutable run with immutable case results and observations', () => {
    const run = runBehavioralEvaluation(
      request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never),
      executionMetadata,
    );

    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.caseResults)).toBe(true);
    expect(Object.isFrozen(run.caseResults[0])).toBe(true);
    expect(Object.isFrozen(run.caseResults[0].modelObservation)).toBe(true);
    expect(Object.isFrozen(run.caseResults[0].modelObservation.observedValues)).toBe(true);
    expect(Object.isFrozen(run.runLevelMetricResults)).toBe(true);
  });

  // Test 1 — MAE is cross-case / fixed-dimension (Model B).
  it('computes MAE per fixed dimension across multiple EvaluationCases, run-level', () => {
    const cases = [exactCase('case-1', 0.6, 0.2), exactCase('case-2', 0.4, 0.5)];
    const run = runBehavioralEvaluation(
      request(cases, () => validResult(0.5, 0.3) as never),
      executionMetadata,
    );

    const maeResults = (run.runLevelMetricResults ?? []).filter((result) => result.metricId === 'MAE');
    expect(maeResults.map((result) => result.dimension).sort()).toEqual(['fear', 'joy']);
    const joyMae = maeResults.find((result) => result.dimension === 'joy');
    const fearMae = maeResults.find((result) => result.dimension === 'fear');
    // joy targets: 0.6, 0.4 vs observed 0.5, 0.5 -> |0.1| and |0.1| -> mean 0.1
    expect(joyMae?.value).toBeCloseTo(0.1);
    expect(joyMae?.sampleSize).toBe(2);
    // fear targets: 0.2, 0.5 vs observed 0.3, 0.3 -> |0.1| and |0.2| -> mean 0.15
    expect(fearMae?.value).toBeCloseTo(0.15);
    expect(fearMae?.sampleSize).toBe(2);
    expect(maeResults.some((result) => result.dimension.includes(','))).toBe(false);
    expect(run.caseResults.every((result) => result.metricResults.length === 0)).toBe(true);
  });

  // Test 2 — RMSE is cross-case / fixed-dimension (Model B).
  it('computes RMSE per fixed dimension across multiple EvaluationCases, run-level', () => {
    const cases = [exactCase('case-1', 0.0, 0.0), exactCase('case-2', 0.0, 0.0)];
    const run = runBehavioralEvaluation(
      request(cases, (input) => {
        const caseId = (input as unknown as { caseId: string }).caseId;
        return (caseId === 'case-1' ? validResult(0.0, 2.0) : validResult(0.0, 0.0)) as never;
      }),
      executionMetadata,
    );

    const rmseResults = (run.runLevelMetricResults ?? []).filter((result) => result.metricId === 'RMSE');
    const fearRmse = rmseResults.find((result) => result.dimension === 'fear');
    const joyRmse = rmseResults.find((result) => result.dimension === 'joy');
    // fear: sqrt(((0-2)^2 + (0-0)^2) / 2) = sqrt(2)
    expect(fearRmse?.value).toBeCloseTo(Math.sqrt(2));
    expect(joyRmse?.value).toBe(0);
    expect(rmseResults.some((result) => result.dimension.includes(','))).toBe(false);
  });

  // Phase 6.4-D final correction: heterogeneous per-dimension availability must not invalidate other dimensions.
  it('filters each dimension independently so a case missing one dimension does not invalidate another', () => {
    const cases = [
      {
        caseId: 'case-both',
        datasetId: 'synthetic-metrics-fixture',
        input: { caseId: 'case-both' },
        referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 0.8, fear: 0.2 } },
      },
      {
        caseId: 'case-joy-only',
        datasetId: 'synthetic-metrics-fixture',
        input: { caseId: 'case-joy-only' },
        referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 0.6 } },
      },
      {
        caseId: 'case-both-2',
        datasetId: 'synthetic-metrics-fixture',
        input: { caseId: 'case-both-2' },
        referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 0.7, fear: 0.4 } },
      },
    ];
    const run = runBehavioralEvaluation(
      request(cases, () => validResult(0.5, 0.3) as never),
      executionMetadata,
    );

    const maeResults = (run.runLevelMetricResults ?? []).filter((result) => result.metricId === 'MAE');
    const rmseResults = (run.runLevelMetricResults ?? []).filter((result) => result.metricId === 'RMSE');
    const joyMae = maeResults.find((result) => result.dimension === 'joy');
    const fearMae = maeResults.find((result) => result.dimension === 'fear');
    const joyRmse = rmseResults.find((result) => result.dimension === 'joy');
    const fearRmse = rmseResults.find((result) => result.dimension === 'fear');

    expect(joyMae?.status).toBe('COMPUTED');
    expect(joyMae?.sampleSize).toBe(3);
    expect(fearMae?.status).toBe('COMPUTED');
    expect(fearMae?.sampleSize).toBe(2);
    expect(joyRmse?.status).toBe('COMPUTED');
    expect(joyRmse?.sampleSize).toBe(3);
    expect(fearRmse?.status).toBe('COMPUTED');
    expect(fearRmse?.sampleSize).toBe(2);
    expect([...maeResults, ...rmseResults].some((result) => result.dimension.includes(','))).toBe(false);
  });

  // Test 3 — Spearman remains case-level.
  it('keeps Spearman as a case-level result tied to its own EvaluationCase', () => {
    const rankingCase = {
      caseId: 'case-ranking',
      datasetId: 'synthetic-metrics-fixture',
      input: { caseId: 'case-ranking' },
      referenceAnnotation: {
        annotationType: 'RANKING' as const,
        targetValues: { joy: 3, fear: 1, valence: 2 },
      },
    };
    const run = runBehavioralEvaluation(
      request([rankingCase], () => validResult(0.9, 0.1) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].caseId).toBe('case-ranking');
    expect(run.caseResults[0].metricResults.map((result) => result.metricId)).toEqual(['SPEARMAN_RHO']);
    expect(run.runLevelMetricResults).toBeUndefined();
  });

  // Test 4 — Pearson is not executed.
  it('never produces a Pearson result even when EXACT_VECTOR data would allow it', () => {
    const cases = [exactCase('case-1', 0.1, 0.9), exactCase('case-2', 0.5, 0.5), exactCase('case-3', 0.9, 0.1)];
    const run = runBehavioralEvaluation(
      request(cases, (input) => {
        const caseId = (input as unknown as { caseId: string }).caseId;
        const values: Record<string, [number, number]> = {
          'case-1': [0.2, 0.8],
          'case-2': [0.5, 0.5],
          'case-3': [0.8, 0.2],
        };
        const [joy, fear] = values[caseId];
        return validResult(joy, fear) as never;
      }),
      executionMetadata,
    );

    expect(allMetricResults(run).some((result) => result.metricId === 'PEARSON_R')).toBe(false);
  });

  // Test 5 — Directional Accuracy is not executed.
  it('never produces a Directional Accuracy result', () => {
    const directionalCase = {
      caseId: 'case-directional',
      datasetId: 'synthetic-metrics-fixture',
      input: { caseId: 'case-directional' },
      referenceAnnotation: {
        annotationType: 'DIRECTIONAL_DELTA' as const,
        targetValues: { confidenceAdjustment: 0 },
      },
    };
    const run = runBehavioralEvaluation(
      request([directionalCase], () => validResult(0.7, 0.2) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].metricResults).toEqual([]);
    expect(allMetricResults(run).some((result) => result.metricId === 'DIRECTIONAL_ACCURACY')).toBe(false);
  });

  // Test 6 — failures and invalid outputs do not become numbers.
  it('excludes FAILED and INVALID_OUTPUT cases from MAE/RMSE without fabricating zero values', () => {
    const cases = [
      exactCase('case-fail', 0.6, 0.2),
      exactCase('case-invalid', 0.6, 0.2),
      exactCase('case-valid', 0.6, 0.2),
    ];
    const run = runBehavioralEvaluation(
      request(cases, (input) => {
        const caseId = (input as unknown as { caseId: string }).caseId;
        if (caseId === 'case-fail') throw new Error('intentional provider failure');
        if (caseId === 'case-invalid') return ({ nextState: { emotionVector: { joy: Number.NaN } } }) as never;
        return validResult(0.6, 0.2) as never;
      }),
      executionMetadata,
    );

    expect(run.caseResults.map((result) => result.modelObservation.status))
      .toEqual(['FAILED', 'INVALID_OUTPUT', 'SUCCESS']);
    expect(run.caseResults[0].modelObservation.observedValues).toBeUndefined();
    expect(run.caseResults[1].modelObservation.observedValues).toBeUndefined();

    const maeResults = (run.runLevelMetricResults ?? []).filter((result) => result.metricId === 'MAE');
    // Only the single SUCCESS case contributes; sampleSize must reflect exactly that, never fabricated zeros.
    expect(maeResults.every((result) => result.sampleSize === 1)).toBe(true);
    expect(maeResults.find((result) => result.dimension === 'joy')?.value).toBeCloseTo(0);
  });

  // Test 7 — no composite dimensions anywhere in the result set.
  it('never encodes composite/joined dimension labels in any MetricResult', () => {
    const cases = [
      exactCase('case-1', 0.6, 0.2),
      {
        caseId: 'case-ranking',
        datasetId: 'synthetic-metrics-fixture',
        input: { caseId: 'case-ranking' },
        referenceAnnotation: {
          annotationType: 'RANKING' as const,
          targetValues: { joy: 3, fear: 1, valence: 2 },
        },
      },
    ];
    const run = runBehavioralEvaluation(
      request(cases, () => validResult(0.6, 0.2) as never),
      executionMetadata,
    );

    for (const result of allMetricResults(run)) {
      expect(result.dimension).not.toContain(',');
    }
  });

  it('isolates thrown provider failures and continues with later cases', () => {
    let calls = 0;
    const cases = [exactCase('case-failed', 0.6, 0.2), exactCase('case-later', 0.6, 0.2)];
    const run = runBehavioralEvaluation(
      request(cases, (input) => {
        calls++;
        if ((input as unknown as { caseId: string }).caseId === 'case-failed') {
          throw new Error('intentional provider failure');
        }
        return validResult(0.6, 0.2) as never;
      }),
      executionMetadata,
    );

    expect(calls).toBe(2);
    expect(run.caseResults).toHaveLength(2);
    expect(run.caseResults.map((result) => result.modelObservation.status))
      .toEqual(['FAILED', 'SUCCESS']);
    expect(run.caseResults[0].modelObservation.failureReason).toContain('intentional');
  });

  it('does not calculate metrics for annotation types deferred by L2-A', () => {
    const intervalCase = {
      caseId: 'case-interval',
      datasetId: 'synthetic-metrics-fixture',
      input: { caseId: 'case-interval' },
      referenceAnnotation: { annotationType: 'INTERVAL' as const, targetValues: { joy: [0.6, 0.8] } },
    };
    const run = runBehavioralEvaluation(
      request([intervalCase], () => validResult(0.7, 0.2) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].modelObservation.status).toBe('SUCCESS');
    expect(run.caseResults[0].metricResults).toEqual([]);
    expect(run.runLevelMetricResults).toBeUndefined();
  });
});

