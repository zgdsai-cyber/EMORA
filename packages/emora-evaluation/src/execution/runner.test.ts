import { describe, expect, it } from 'vitest';

import type { StateTransitionProvider } from '@emora/emotional-core';

import type { EvaluationDataset, EvaluationRequest } from '../contracts';
import { computeDatasetHash, EvaluationContractViolationError } from '../dataset/identity';
import { computeEvaluationContractHash, EVALUATION_CONTRACT_VERSION } from '../contract-hash';
import { MAE_METRIC_DEFINITION, RMSE_METRIC_DEFINITION, SPEARMAN_METRIC_DEFINITION } from '../metrics/definitions';
import { aggregateEvaluationReport } from '../report/aggregator';
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

function dataset(
  evaluationCases: EvaluationRequest['dataset']['cases'],
  overrides: Partial<EvaluationDataset> = {},
): EvaluationDataset {
  const identity = {
    datasetId: 'synthetic-metrics-fixture',
    datasetVersion: '1.0.0',
    referenceType: 'SYNTHETIC_ORACLE' as const,
    cases: evaluationCases,
  };
  return {
    ...identity,
    datasetHash: computeDatasetHash(identity),
    role: 'DESIGN',
    title: 'Software metric fixture',
    description: 'Synthetic fixture for runner behavior only.',
    casesCount: evaluationCases.length,
    provenanceMetadata: {},
    ...overrides,
  };
}

function request(
  evaluationCases: EvaluationRequest['dataset']['cases'],
  transition: StateTransitionProvider['transition'],
  datasetOverrides: Partial<EvaluationDataset> = {},
): EvaluationRequest {
  return {
    dataset: dataset(evaluationCases, datasetOverrides),
    engine: {
      provider: provider(transition),
      runtimeContract: 'node-22-test-contract',
      engineVersion: '1.0.0',
      engineCommit: 'engine-commit-supplied-by-caller',
    },
    parameterVersionId: 'opaque-parameter-version',
    parameterVersionHash: 'opaque-parameter-hash',
    evaluationContractVersion: EVALUATION_CONTRACT_VERSION,
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

function rankingCase(caseId: string, targetValues: Record<string, unknown>) {
  return {
    caseId,
    datasetId: 'synthetic-metrics-fixture',
    input: { caseId },
    referenceAnnotation: { annotationType: 'RANKING' as const, targetValues },
  };
}

function coverageFor(run: ReturnType<typeof runBehavioralEvaluation>, metricId: string, dimension: string) {
  return run.metricCoverage.find((entry) => entry.metricId === metricId && entry.dimension === dimension);
}

function allMetricResults(run: ReturnType<typeof runBehavioralEvaluation>) {
  return [
    ...run.caseResults.flatMap((result) => result.metricResults),
    ...(run.runLevelMetricResults ?? []),
  ];
}

describe('runBehavioralEvaluation', () => {
  it('preserves dataset/engine/parameter/contract provenance', () => {
    const evaluationRequest = request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never);
    const run = runBehavioralEvaluation(evaluationRequest, executionMetadata);

    expect(run.datasetIdentity).toEqual({
      datasetId: 'synthetic-metrics-fixture',
      datasetVersion: '1.0.0',
      datasetHash: evaluationRequest.dataset.datasetHash,
    });
    expect(run.datasetRole).toBe('DESIGN');
    expect(run.engineIdentity).toEqual({
      engineVersion: '1.0.0',
      engineCommit: 'engine-commit-supplied-by-caller',
      runtimeContract: 'node-22-test-contract',
    });
    expect(run.parameterVersionId).toBe('opaque-parameter-version');
    expect(run.parameterVersionHash).toBe('opaque-parameter-hash');
    expect(run.evaluationContractVersion).toBe(EVALUATION_CONTRACT_VERSION);
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
    expect(Object.isFrozen(run.metricCoverage)).toBe(true);
    expect(Object.isFrozen(run.technicalContractViolations)).toBe(true);
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

  // Test 3 — Spearman remains case-level (MDS §5.2 unit = (case, ranking-space)).
  it('keeps Spearman as a case-level result tied to its own EvaluationCase in the EMOTION ranking space', () => {
    const run = runBehavioralEvaluation(
      request([rankingCase('case-ranking', { joy: 1, fear: 3, anger: 2 })], () => ({
        ...validResult(0.9, 0.1),
        nextState: { ...validResult(0.9, 0.1).nextState, emotionVector: { joy: 0.9, fear: 0.1, anger: 0.5 } },
      }) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].caseId).toBe('case-ranking');
    expect(run.caseResults[0].metricResults.map((result) => result.metricId)).toEqual(['SPEARMAN_RHO']);
    expect(run.caseResults[0].metricResults[0].dimension).toBe('EMOTION');
    expect(run.caseResults[0].metricResults[0].value).toBeCloseTo(1);
    expect(run.runLevelMetricResults).toBeUndefined();
    expect(coverageFor(run, 'SPEARMAN_RHO', 'EMOTION')).toMatchObject({ planned: 1, eligible: 1, contributing: 1, excluded: 0 });
  });

  // MDS §6.3 — RANK_1_IS_HIGHEST: rank 1 must align with the highest model score.
  it('applies RANK_1_IS_HIGHEST so an inverted reference ranking yields rho = -1', () => {
    const run = runBehavioralEvaluation(
      request([rankingCase('case-ranking', { joy: 3, fear: 1, anger: 2 })], () => ({
        ...validResult(0.9, 0.1),
        nextState: { ...validResult(0.9, 0.1).nextState, emotionVector: { joy: 0.9, fear: 0.1, anger: 0.5 } },
      }) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].metricResults[0].value).toBeCloseTo(-1);
  });

  // MDS §6.3 — fractional ranks for model-side ties.
  it('assigns fractional ranks to tied model scores', () => {
    const run = runBehavioralEvaluation(
      request([rankingCase('case-ranking', { joy: 1, fear: 2, anger: 3 })], () => ({
        ...validResult(0.9, 0.9),
        nextState: { ...validResult(0.9, 0.9).nextState, emotionVector: { joy: 0.9, fear: 0.9, anger: 0.1 } },
      }) as never),
      executionMetadata,
    );

    // reference ranks 1,2,3 vs model fractional ranks 1.5,1.5,3 -> rho = 0.866
    expect(run.caseResults[0].metricResults[0].status).toBe('COMPUTED');
    expect(run.caseResults[0].metricResults[0].value).toBeCloseTo(Math.sqrt(3) / 2, 5);
  });

  // MDS §6.4 negative test — mixed semantic space is a technical contract violation, never a Spearman result.
  it('rejects a ranking that mixes EMOTION with CONTINUOUS_AFFECT as MIXED_SEMANTIC_SPACE', () => {
    const run = runBehavioralEvaluation(
      request([rankingCase('case-mixed', { joy: 1, fear: 3, valence: 2 })], () => validResult(0.9, 0.1) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].metricResults).toEqual([]);
    expect(run.technicalContractViolations).toEqual([
      { violation: 'MIXED_SEMANTIC_SPACE', caseId: 'case-mixed', source: 'REFERENCE', dimension: 'valence', metricId: 'SPEARMAN_RHO' },
    ]);
    expect(coverageFor(run, 'SPEARMAN_RHO', 'EMOTION')).toMatchObject({
      planned: 1,
      eligible: 0,
      contributing: 0,
      excluded: 1,
      exclusions: [{ caseId: 'case-mixed', reason: 'MIXED_SEMANTIC_SPACE', detail: 'valence' }],
    });
  });

  // MDS §3.4 — unknown dimensions are reported, never silently ignored.
  it('reports UNKNOWN_DIMENSION for reference dimensions absent from the registry', () => {
    const run = runBehavioralEvaluation(
      request([
        rankingCase('case-unknown-rank', { joy: 1, serenity: 2 }),
        { ...exactCase('case-unknown-exact', 0.5, 0.5), referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 0.5, serenity: 0.5 } } },
      ], () => validResult(0.5, 0.5) as never),
      executionMetadata,
    );

    expect(run.technicalContractViolations.map((violation) => [violation.violation, violation.caseId, violation.dimension])).toEqual([
      ['UNKNOWN_DIMENSION', 'case-unknown-rank', 'serenity'],
      ['UNKNOWN_DIMENSION', 'case-unknown-exact', 'serenity'],
      ['UNKNOWN_DIMENSION', 'case-unknown-exact', 'serenity'],
    ]);
    expect(run.technicalContractViolations.every((violation) => violation.source === 'REFERENCE')).toBe(true);
    expect(coverageFor(run, 'MAE', 'serenity')).toMatchObject({ planned: 1, eligible: 0, contributing: 0, exclusions: [{ caseId: 'case-unknown-exact', reason: 'UNKNOWN_DIMENSION' }] });
    expect((run.runLevelMetricResults ?? []).some((result) => result.dimension === 'serenity')).toBe(false);
    expect(coverageFor(run, 'MAE', 'joy')).toMatchObject({ planned: 1, contributing: 1 });
  });

  // Review Point A2 — unknown model-output metadata outside the contract is not a violation and does not exclude the case.
  it('evaluates known contractual dimensions unchanged when the model emits unrelated unknown metadata', () => {
    const run = runBehavioralEvaluation(
      request([exactCase('case-1', 0.6, 0.2), rankingCase('case-rank', { joy: 1, fear: 2 })], () => ({
        ...validResult(0.6, 0.2),
        nextState: { ...validResult(0.6, 0.2).nextState, emotionVector: { joy: 0.6, fear: 0.2, serenity: 0.9 } },
      }) as never),
      executionMetadata,
    );

    expect(run.technicalContractViolations).toEqual([]);
    expect(run.caseResults[0].modelObservation.observedValues?.serenity).toBe(0.9);
    expect(coverageFor(run, 'MAE', 'joy')).toMatchObject({ planned: 1, eligible: 1, contributing: 1, excluded: 0 });
    expect(coverageFor(run, 'SPEARMAN_RHO', 'EMOTION')).toMatchObject({ planned: 1, eligible: 1, contributing: 1, excluded: 0 });
    expect(run.metricCoverage.some((entry) => entry.dimension === 'serenity')).toBe(false);
  });

  // MDS §6.2 (A1) — reference competition ranks; ties allowed; other integer labels rejected.
  const emotionDims = ['joy', 'fear', 'anger', 'trust', 'love'] as const;
  function rankingFixture(ranks: readonly number[]) {
    const dims = emotionDims.slice(0, ranks.length);
    const targetValues = Object.fromEntries(dims.map((dim, index) => [dim, ranks[index]]));
    const emotionVector = Object.fromEntries(dims.map((dim, index) => [dim, 1 - index * 0.1]));
    return { targetValues, transition: () => ({ ...validResult(0.5, 0.5), nextState: { ...validResult(0.5, 0.5).nextState, emotionVector } }) as never };
  }

  it.each([
    [[1, 2, 3]],
    [[1, 1, 3]],
    [[1, 2, 2]],
    [[1, 1, 3, 4]],
    [[1, 2, 2, 4]],
    [[1, 2, 2, 2]],
    [[1, 2, 2, 2, 5]],
  ])('accepts valid competition ranking %j and computes Spearman', (ranks) => {
    const fixture = rankingFixture(ranks);
    const run = runBehavioralEvaluation(
      request([rankingCase('case-valid', fixture.targetValues)], fixture.transition),
      executionMetadata,
    );

    expect(run.caseResults[0].metricResults[0]).toMatchObject({ metricId: 'SPEARMAN_RHO', status: 'COMPUTED', dimension: 'EMOTION' });
    expect(coverageFor(run, 'SPEARMAN_RHO', 'EMOTION')).toMatchObject({ planned: 1, eligible: 1, contributing: 1, excluded: 0 });
    expect(run.technicalContractViolations).toEqual([]);
  });

  it.each([
    [[1, 1, 2]],
    [[1, 2, 2, 3]],
    [[2, 2, 3]],
    [[1, 1, 4]],
    [[1, 1, 4, 4]],
    [[0, 1, 2]],
    [[1, 2, 3, 5]],
    [[1.5, 1.5, 3]],
  ])('rejects reference ranking %j as REFERENCE_INVALID without a Spearman result', (ranks) => {
    const fixture = rankingFixture(ranks);
    const run = runBehavioralEvaluation(
      request([rankingCase('case-bad-rank', fixture.targetValues)], fixture.transition),
      executionMetadata,
    );

    expect(run.caseResults[0].metricResults).toEqual([]);
    expect(run.technicalContractViolations).toEqual([]);
    const spearman = coverageFor(run, 'SPEARMAN_RHO', 'EMOTION');
    expect(spearman).toMatchObject({ planned: 1, eligible: 0, contributing: 0, excluded: 1 });
    expect(spearman?.exclusions[0]).toMatchObject({ caseId: 'case-bad-rank', reason: 'REFERENCE_INVALID' });
    expect(spearman?.exclusions[0].detail).toContain('competition ranking');
  });

  // MDS §6.3 (A1) — approved: reference competition ties become average ranks for Spearman; the annotation is preserved.
  it('converts tied reference competition ranks to average ranks for Spearman while preserving the original annotation', () => {
    const referenceCase = rankingCase('case-tied-ref', { joy: 1, fear: 1, anger: 3 });
    const evaluationRequest = request([referenceCase], () => ({
      ...validResult(0.9, 0.9),
      nextState: { ...validResult(0.9, 0.9).nextState, emotionVector: { joy: 0.9, fear: 0.9, anger: 0.1 } },
    }) as never);
    const run = runBehavioralEvaluation(evaluationRequest, executionMetadata);

    // reference [1,1,3] -> [1.5,1.5,3]; model (0.9,0.9,0.1) -> [1.5,1.5,3]; rho = 1
    expect(run.caseResults[0].metricResults[0]).toMatchObject({ status: 'COMPUTED', dimension: 'EMOTION' });
    expect(run.caseResults[0].metricResults[0].value).toBeCloseTo(1);
    expect(evaluationRequest.dataset.cases[0].referenceAnnotation.targetValues).toEqual({ joy: 1, fear: 1, anger: 3 });

    // Model side ranks independently: reference tie vs strict model ordering gives rho = sqrt(3)/2.
    const strictModel = runBehavioralEvaluation(
      request([referenceCase], () => ({
        ...validResult(0.9, 0.5),
        nextState: { ...validResult(0.9, 0.5).nextState, emotionVector: { joy: 0.9, fear: 0.5, anger: 0.1 } },
      }) as never),
      executionMetadata,
    );
    expect(strictModel.caseResults[0].metricResults[0].value).toBeCloseTo(Math.sqrt(3) / 2, 5);
  });

  // Review Point C — MetricCoverage is authoritative; exclusion reasons are not collapsed into "missing".
  it('keeps UNKNOWN_DIMENSION and MIXED_SEMANTIC_SPACE as distinct exclusion reasons rather than missing data', () => {
    const run = runBehavioralEvaluation(
      request([
        rankingCase('case-mixed', { joy: 1, valence: 2 }),
        { ...exactCase('case-unknown', 0, 0), referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { serenity: 0.1 } } },
        { ...exactCase('case-missing', 0, 0), referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: undefined } } },
      ], () => validResult(0.5, 0.5) as never),
      executionMetadata,
    );

    expect(coverageFor(run, 'SPEARMAN_RHO', 'EMOTION')?.exclusions).toEqual([{ caseId: 'case-mixed', reason: 'MIXED_SEMANTIC_SPACE', detail: 'valence' }]);
    expect(coverageFor(run, 'MAE', 'serenity')?.exclusions).toEqual([{ caseId: 'case-unknown', reason: 'UNKNOWN_DIMENSION' }]);
    expect(coverageFor(run, 'MAE', 'joy')?.exclusions).toEqual([{ caseId: 'case-missing', reason: 'REFERENCE_MISSING' }]);
    const reasons = run.metricCoverage.flatMap((entry) => entry.exclusions.map((exclusion) => exclusion.reason));
    expect(new Set(reasons)).toEqual(new Set(['MIXED_SEMANTIC_SPACE', 'UNKNOWN_DIMENSION', 'REFERENCE_MISSING']));
    // Legacy field is not a coverage projection: stays at the pure-function value.
    expect((run.runLevelMetricResults ?? []).every((result) => result.missingCasesCount === 0)).toBe(true);
  });

  // Phase 6.7 — MetricCoverage is authoritative; the legacy scalar cannot redefine coverage.
  it('keeps MetricCoverage authoritative: excluded counts come from coverage, never from missingCasesCount', () => {
    const run = runBehavioralEvaluation(
      request([exactCase('case-fail', 0.6, 0.2), exactCase('case-ok', 0.6, 0.2), exactCase('case-ok-2', 0.4, 0.4)], (input) => {
        if ((input as unknown as { caseId: string }).caseId === 'case-fail') throw new Error('boom');
        return validResult(0.6, 0.2) as never;
      }),
      executionMetadata,
    );

    const joy = coverageFor(run, 'MAE', 'joy');
    expect(joy).toMatchObject({ planned: 3, eligible: 2, contributing: 2, excluded: 1 });
    expect(joy?.planned).toBe((joy?.contributing ?? 0) + (joy?.excluded ?? 0));
    const mae = (run.runLevelMetricResults ?? []).find((result) => result.metricId === 'MAE' && result.dimension === 'joy');
    expect(mae?.sampleSize).toBe(2);
    expect(mae?.missingCasesCount).toBe(0);
    expect(mae?.missingCasesCount).not.toBe(joy?.excluded);
  });

  // Review Point D — both hash-mismatch paths: runner throws before any run exists; a RUN_FAILED attempt reaches the aggregator as FAILED.
  it('propagates a runner DATASET_HASH_MISMATCH through a RUN_FAILED attempt to a FAILED report', () => {
    const evaluationRequest = request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { datasetHash: 'not-the-canonical-hash' });
    let thrown: EvaluationContractViolationError | undefined;
    try {
      runBehavioralEvaluation(evaluationRequest, executionMetadata);
    } catch (error) {
      thrown = error as EvaluationContractViolationError;
    }
    expect(thrown?.violation).toBe('DATASET_HASH_MISMATCH');

    const attemptedDatasetIdentity = {
      datasetId: evaluationRequest.dataset.datasetId,
      datasetVersion: evaluationRequest.dataset.datasetVersion,
      datasetHash: evaluationRequest.dataset.datasetHash,
    };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_FAILED', failureReason: thrown!.message, attemptedDatasetIdentity, technicalFailure: thrown!.violation },
      {
        reportId: 'report-hash-path',
        dataset: evaluationRequest.dataset,
        metricDefinitions: [MAE_METRIC_DEFINITION, RMSE_METRIC_DEFINITION, SPEARMAN_METRIC_DEFINITION],
        referenceObservationStatuses: { datasetIdentity: attemptedDatasetIdentity, observations: [] },
      },
    );

    expect(report.executionStatus).toBe('FAILED');
    if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
    expect(report.technicalFailure).toBe('DATASET_HASH_MISMATCH');
    expect('run' in report).toBe(false);
  });

  // MDS §6.5 — n < 2 is a computational exclusion, not a silent skip.
  it('records INSUFFICIENT_DATA coverage for a single-item ranking', () => {
    const run = runBehavioralEvaluation(
      request([rankingCase('case-one', { joy: 1 })], () => validResult(0.9, 0.1) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].metricResults).toEqual([]);
    expect(coverageFor(run, 'SPEARMAN_RHO', 'EMOTION')?.exclusions).toEqual([
      { caseId: 'case-one', reason: 'INSUFFICIENT_DATA', detail: 'n=1 < 2' },
    ]);
  });

  // MDS §6.6 / §8.2 — excluded ranking cases stay observable with their reason.
  it('keeps excluded ranking cases observable through coverage with distinct execution and reference reasons', () => {
    const run = runBehavioralEvaluation(
      request([
        rankingCase('case-failed', { joy: 1, fear: 2 }),
        rankingCase('case-invalid-ref', { joy: 1, fear: 'second' }),
        rankingCase('case-zero-rank', { joy: 0, fear: 1 }),
        rankingCase('case-absent-model', { joy: 1, anger: 2 }),
        rankingCase('case-ok', { joy: 1, fear: 2 }),
      ], (input) => {
        if ((input as unknown as { caseId: string }).caseId === 'case-failed') throw new Error('boom');
        return validResult(0.9, 0.1) as never;
      }),
      executionMetadata,
    );

    const spearman = coverageFor(run, 'SPEARMAN_RHO', 'EMOTION');
    expect(spearman).toMatchObject({ planned: 5, eligible: 1, contributing: 1, excluded: 4 });
    expect(spearman?.exclusions.map((exclusion) => [exclusion.caseId, exclusion.reason])).toEqual([
      ['case-failed', 'EXECUTION_FAILED'],
      ['case-invalid-ref', 'REFERENCE_INVALID'],
      ['case-zero-rank', 'REFERENCE_INVALID'],
      ['case-absent-model', 'MODEL_DIMENSION_ABSENT'],
    ]);
    expect(run.technicalContractViolations).toEqual([]);
  });

  // Phase 6.11 — Pearson is a run-level, fixed-dimension descriptive metric.
  it('computes Pearson per eligible fixed dimension and records coverage', () => {
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

    const pearsonResults = (run.runLevelMetricResults ?? []).filter((result) => result.metricId === 'PEARSON_R');
    expect(pearsonResults.map((result) => result.dimension).sort()).toEqual(['fear', 'joy']);
    expect(pearsonResults.every((result) => result.status === 'COMPUTED')).toBe(true);
    expect(pearsonResults.every((result) => Math.abs(result.value - 1) < 1e-12)).toBe(true);
    expect(coverageFor(run, 'PEARSON_R', 'joy')).toMatchObject({ planned: 3, eligible: 3, contributing: 3, excluded: 0 });
    expect(coverageFor(run, 'PEARSON_R', 'fear')).toMatchObject({ planned: 3, eligible: 3, contributing: 3, excluded: 0 });
  });

  it('records a mathematically undefined Pearson result and explicit coverage', () => {
    const cases = [exactCase('case-1', 0.5, 0.2), exactCase('case-2', 0.5, 0.4)];
    const run = runBehavioralEvaluation(
      request(cases, () => validResult(0.4, 0.3) as never),
      executionMetadata,
    );

    const pearson = (run.runLevelMetricResults ?? []).find((result) => result.metricId === 'PEARSON_R' && result.dimension === 'joy');
    expect(pearson).toMatchObject({ status: 'UNDEFINED', sampleSize: 2 });
    expect(coverageFor(run, 'PEARSON_R', 'joy')).toMatchObject({
      planned: 2,
      eligible: 2,
      contributing: 0,
      excluded: 2,
      exclusions: [
        { caseId: 'case-1', reason: 'METRIC_UNDEFINED' },
        { caseId: 'case-2', reason: 'METRIC_UNDEFINED' },
      ],
    });
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
    expect(maeResults.every((result) => result.missingCasesCount === 0)).toBe(true);
    expect(maeResults.find((result) => result.dimension === 'joy')?.value).toBeCloseTo(0);
    expect(coverageFor(run, 'MAE', 'joy')).toMatchObject({
      planned: 3,
      eligible: 1,
      contributing: 1,
      excluded: 2,
      exclusions: [
        { caseId: 'case-fail', reason: 'EXECUTION_FAILED' },
        { caseId: 'case-invalid', reason: 'EXECUTION_INVALID_OUTPUT' },
      ],
    });
  });

  // MDS §3.3 / §4 — COMPUTATIONAL dimensions never enter behavioral fixed-dimension metrics.
  it('excludes confidence and confidenceAdjustment from behavioral metrics without deleting them from model output', () => {
    const run = runBehavioralEvaluation(
      request([{
        ...exactCase('case-conf', 0.6, 0.2),
        referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 0.6, confidence: 0.8, confidenceAdjustment: 0 } },
      }], () => validResult(0.6, 0.2) as never),
      executionMetadata,
    );

    expect(run.caseResults[0].modelObservation.observedValues?.confidence).toBe(0.8);
    expect((run.runLevelMetricResults ?? []).map((result) => result.dimension)).toEqual(['joy', 'joy', 'joy']);
    expect(coverageFor(run, 'MAE', 'confidence')).toMatchObject({
      planned: 1,
      eligible: 0,
      contributing: 0,
      exclusions: [{ caseId: 'case-conf', reason: 'COMPUTATIONAL_DIMENSION_EXCLUDED' }],
    });
    expect(coverageFor(run, 'RMSE', 'confidenceAdjustment')?.exclusions[0].reason).toBe('COMPUTATIONAL_DIMENSION_EXCLUDED');
    expect(coverageFor(run, 'PEARSON_R', 'confidence')?.exclusions[0].reason).toBe('COMPUTATIONAL_DIMENSION_EXCLUDED');
    expect(run.technicalContractViolations).toEqual([]);
  });

  // MDS §7 — valence error may exceed 1; MAE/RMSE are non-negative error statistics.
  it('evaluates valence independently with absolute error up to 2', () => {
    const run = runBehavioralEvaluation(
      request([{
        ...exactCase('case-valence', 0, 0),
        referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { valence: -1 } },
      }], () => validResult(1, 0) as never),
      executionMetadata,
    );

    const mae = (run.runLevelMetricResults ?? []).find((result) => result.metricId === 'MAE' && result.dimension === 'valence');
    expect(mae?.status).toBe('COMPUTED');
    expect(mae?.value).toBeCloseTo(2);
  });

  // MDS §8.1 — missing and invalid references are distinct exclusion reasons.
  it('distinguishes REFERENCE_MISSING from REFERENCE_INVALID in coverage', () => {
    const run = runBehavioralEvaluation(
      request([
        { ...exactCase('case-missing', 0, 0), referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: null } } },
        { ...exactCase('case-invalid', 0, 0), referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 'high' } } },
      ], () => validResult(0.5, 0.5) as never),
      executionMetadata,
    );

    expect(coverageFor(run, 'MAE', 'joy')).toMatchObject({
      planned: 2,
      eligible: 0,
      contributing: 0,
      excluded: 2,
      exclusions: [
        { caseId: 'case-missing', reason: 'REFERENCE_MISSING' },
        { caseId: 'case-invalid', reason: 'REFERENCE_INVALID' },
      ],
    });
    const mae = (run.runLevelMetricResults ?? []).find((result) => result.metricId === 'MAE' && result.dimension === 'joy');
    expect(mae?.status).toBe('INSUFFICIENT_DATA');
    expect(mae?.missingCasesCount).toBe(0);
    expect(coverageFor(run, 'MAE', 'joy')?.excluded).toBe(2);
  });

  // MDS §13 — dataset hash mismatch is fatal, not a warning.
  it('throws DATASET_HASH_MISMATCH when the claimed dataset hash is not canonical', () => {
    const evaluationRequest = request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { datasetHash: 'not-the-canonical-hash' });

    expect(() => runBehavioralEvaluation(evaluationRequest, executionMetadata)).toThrowError(EvaluationContractViolationError);
    try {
      runBehavioralEvaluation(evaluationRequest, executionMetadata);
    } catch (error) {
      expect((error as EvaluationContractViolationError).violation).toBe('DATASET_HASH_MISMATCH');
    }
  });

  // MDS §12 — HELD_OUT provenance is preserved verbatim.
  it('preserves HELD_OUT role and held-out parameter versions', () => {
    const run = runBehavioralEvaluation(
      request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { role: 'HELD_OUT', heldOutParameterVersionIds: ['pv-1', 'pv-2', 'opaque-parameter-version'] }),
      executionMetadata,
    );

    expect(run.datasetRole).toBe('HELD_OUT');
    expect(run.heldOutParameterVersionIds).toEqual(['pv-1', 'pv-2', 'opaque-parameter-version']);
    expect(Object.isFrozen(run.heldOutParameterVersionIds)).toBe(true);
  });

  // Phase 6.7 — technical provenance.
  describe('technical provenance (Phase 6.7)', () => {
    it('records the deterministic evaluation contract hash, independent of timestamp and results', () => {
      const first = runBehavioralEvaluation(request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never), executionMetadata);
      const laterTimestamp = runBehavioralEvaluation(request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never), { ...executionMetadata, executionTimestamp: '2030-01-01T00:00:00.000Z' });
      const differentResults = runBehavioralEvaluation(request([exactCase('case-1', 0.1, 0.9)], () => validResult(0.9, 0.1) as never), executionMetadata);

      expect(first.evaluationContractHash).toBe(computeEvaluationContractHash());
      expect(laterTimestamp.evaluationContractHash).toBe(first.evaluationContractHash);
      expect(differentResults.evaluationContractHash).toBe(first.evaluationContractHash);
    });

    it('preserves caller-supplied toolchainIdentity exactly and never invents one', () => {
      const base = request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never);
      const withToolchain = runBehavioralEvaluation({ ...base, toolchainIdentity: 'node@24.14.0 pnpm@10 lock:abc123' }, executionMetadata);
      const without = runBehavioralEvaluation(base, executionMetadata);
      expect(withToolchain.toolchainIdentity).toBe('node@24.14.0 pnpm@10 lock:abc123');
      expect(without.toolchainIdentity).toBeUndefined();
    });
  });

  // Phase 6.7 — dataset integrity (technical, not leakage detection).
  describe('dataset integrity (Phase 6.7)', () => {
    function violationOf(fn: () => unknown) {
      try { fn(); } catch (error) { return (error as EvaluationContractViolationError).violation; }
      return undefined;
    }

    it('accepts casesCount === cases.length', () => {
      const run = runBehavioralEvaluation(request([exactCase('case-1', 0.7, 0.2), exactCase('case-2', 0.5, 0.5)], () => validResult(0.7, 0.2) as never), executionMetadata);
      expect(run.caseResults).toHaveLength(2);
    });

    it('throws CASES_COUNT_MISMATCH when casesCount disagrees with cases.length', () => {
      const evaluationRequest = request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { casesCount: 3 });
      expect(violationOf(() => runBehavioralEvaluation(evaluationRequest, executionMetadata))).toBe('CASES_COUNT_MISMATCH');
    });

    it('accepts a HELD_OUT dataset when the evaluated parameter version is declared held out', () => {
      const run = runBehavioralEvaluation(
        request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { role: 'HELD_OUT', heldOutParameterVersionIds: ['opaque-parameter-version'] }),
        executionMetadata,
      );
      expect(run.datasetRole).toBe('HELD_OUT');
    });

    it('throws HELD_OUT_PARAMETER_VERSION_MISMATCH when the evaluated parameter version is not declared held out', () => {
      const evaluationRequest = request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { role: 'HELD_OUT', heldOutParameterVersionIds: ['pv-other'] });
      expect(violationOf(() => runBehavioralEvaluation(evaluationRequest, executionMetadata))).toBe('HELD_OUT_PARAMETER_VERSION_MISMATCH');
    });

    it('does not apply HELD_OUT parameter-version validation to DESIGN datasets', () => {
      const run = runBehavioralEvaluation(
        request([exactCase('case-1', 0.7, 0.2)], () => validResult(0.7, 0.2) as never, { role: 'DESIGN', heldOutParameterVersionIds: ['pv-other'] }),
        executionMetadata,
      );
      expect(run.datasetRole).toBe('DESIGN');
    });
  });

  // MDS §23 — determinism of the changed paths (coverage, violations, ranking).
  it('produces identical coverage, violations, and ranking results on repeated execution', () => {
    const evaluationRequest = request([
      rankingCase('case-ok', { joy: 1, fear: 2 }),
      rankingCase('case-mixed', { joy: 1, valence: 2 }),
      exactCase('case-exact', 0.6, 0.2),
      { ...exactCase('case-unknown', 0, 0), referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { serenity: 0.1 } } },
    ], () => validResult(0.6, 0.2) as never);

    const first = runBehavioralEvaluation(evaluationRequest, executionMetadata);
    const second = runBehavioralEvaluation(evaluationRequest, executionMetadata);
    expect(first).toEqual(second);
    expect(first.metricCoverage).toEqual(second.metricCoverage);
    expect(first.technicalContractViolations).toEqual(second.technicalContractViolations);
  });

  // Test 7 — no composite dimensions anywhere in the result set.
  it('never encodes composite/joined dimension labels in any MetricResult', () => {
    const cases = [
      exactCase('case-1', 0.6, 0.2),
      rankingCase('case-ranking', { joy: 1, fear: 2 }),
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

