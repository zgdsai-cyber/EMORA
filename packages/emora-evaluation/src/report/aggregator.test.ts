import { describe, expect, it } from 'vitest';

import type {
  EvaluationCase,
  EvaluationDataset,
  EvaluationReportContext,
  EvaluationRun,
  MetricResult,
  ModelObservationStatus,
} from '../contracts';
import { computeDatasetHash } from '../dataset/identity';
import { computeEvaluationContractHash } from '../contract-hash';
import {
  DIRECTIONAL_ACCURACY_DEFINITION,
  MAE_METRIC_DEFINITION,
  PEARSON_METRIC_DEFINITION,
  RMSE_METRIC_DEFINITION,
  SPEARMAN_METRIC_DEFINITION,
} from '../metrics/definitions';
import { aggregateEvaluationReport } from './aggregator';

const datasetId = 'report-fixture-dataset';
const datasetVersion = '1.0.0';

function fixtureCases(caseIds: readonly string[]): EvaluationCase[] {
  return caseIds.map((caseId) => ({
    caseId,
    datasetId,
    input: {},
    referenceAnnotation: { annotationType: 'EXACT_VECTOR', targetValues: { joy: 0.5 } },
  }));
}

function dataset(caseIds: readonly string[] = ['case-1', 'case-2'], cases: readonly EvaluationCase[] = fixtureCases(caseIds)): EvaluationDataset {
  const identity = { datasetId, datasetVersion, referenceType: 'SYNTHETIC_ORACLE' as const, cases };
  return {
    ...identity,
    datasetHash: computeDatasetHash(identity),
    role: 'DESIGN',
    title: 'Software report fixture',
    description: 'Synthetic fixture for report aggregation only.',
    casesCount: cases.length,
    provenanceMetadata: { fixture: true },
  };
}

const defaultDataset = dataset();
const datasetIdentity = {
  datasetId: defaultDataset.datasetId,
  datasetVersion: defaultDataset.datasetVersion,
  datasetHash: defaultDataset.datasetHash,
};

function identityOf(fixtureDataset: EvaluationDataset) {
  return { datasetId: fixtureDataset.datasetId, datasetVersion: fixtureDataset.datasetVersion, datasetHash: fixtureDataset.datasetHash };
}

function metricResult(
  metricId: string,
  status: MetricResult['status'] = 'COMPUTED',
): MetricResult {
  return { metricId, dimension: 'joy', value: 0.1, sampleSize: 2, missingCasesCount: 0, status };
}

function run(
  observations: readonly ModelObservationStatus[],
  caseIds = ['case-1', 'case-2'],
  identity = datasetIdentity,
): EvaluationRun {
  return {
    runId: 'run-fixture',
    datasetIdentity: identity,
    engineIdentity: { engineVersion: '1.0.0', engineCommit: 'fixture-commit', runtimeContract: 'fixture-runtime' },
    evaluationContractVersion: '6.5-b-fixture',
    evaluationContractHash: computeEvaluationContractHash(),
    datasetRole: 'DESIGN',
    caseResults: observations.map((status, index) => ({
      caseId: caseIds[index],
      modelObservation: {
        caseId: caseIds[index],
        status,
        ...(status === 'SUCCESS' ? { observedValues: { joy: 0.5 } } : {}),
      },
      metricResults: status === 'SUCCESS' ? [metricResult('SPEARMAN_RHO')] : [],
    })),
    runLevelMetricResults: [metricResult('MAE'), metricResult('RMSE', 'INSUFFICIENT_DATA')],
    metricCoverage: [],
    technicalContractViolations: [],
    executionTimestamp: '2026-09-13T00:00:00.000Z',
  };
}

function context(overrides: Partial<EvaluationReportContext> = {}): EvaluationReportContext {
  const fixtureDataset = overrides.dataset ?? defaultDataset;
  return {
    reportId: 'report-fixture',
    dataset: fixtureDataset,
    metricDefinitions: [
      MAE_METRIC_DEFINITION,
      RMSE_METRIC_DEFINITION,
      PEARSON_METRIC_DEFINITION,
      SPEARMAN_METRIC_DEFINITION,
      DIRECTIONAL_ACCURACY_DEFINITION,
    ],
    referenceObservationStatuses: {
      datasetIdentity: identityOf(fixtureDataset),
      observations: [
        { caseId: 'case-1', targetId: 'joy', status: 'OBSERVED' },
        { caseId: 'case-2', targetId: 'joy', status: 'MISSING' },
        { caseId: 'case-2', targetId: 'fear', status: 'NOT_APPLICABLE' },
        { caseId: 'case-2', targetId: 'trust', status: 'INVALID' },
      ],
    },
    ...overrides,
  };
}

describe('aggregateEvaluationReport', () => {
  it('returns COMPLETE with exact execution, missingness, metric, and provenance summaries', () => {
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS']) },
      context(),
    );

    expect(report.executionStatus).toBe('COMPLETE');
    if (report.executionStatus === 'FAILED') throw new Error('Expected run report.');
    expect(report.executionSummary).toEqual({
      totalCases: 2,
      successCount: 2,
      failedCount: 0,
      invalidOutputCount: 0,
      notExecutedCount: 0,
    });
    expect(report.missingnessSummary).toEqual({
      observedCount: 1,
      missingCount: 1,
      notApplicableCount: 1,
      invalidCount: 1,
    });
    expect(report.scientificProvenance.referenceType).toBe('SYNTHETIC_ORACLE');
    expect(report.scientificProvenance.datasetRole).toBe('DESIGN');
    expect(report.run).toBeDefined();
    expect(report.counterexampleReferences).toBeUndefined();
  });

  it('preserves a mathematically undefined Pearson result as UNDEFINED', () => {
    const pearsonUndefinedRun = {
      ...run(['SUCCESS', 'SUCCESS']),
      runLevelMetricResults: [metricResult('PEARSON_R', 'UNDEFINED')],
    };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: pearsonUndefinedRun },
      context(),
    );

    if (report.executionStatus === 'FAILED') throw new Error('Expected run report.');
    expect(report.metricStatusSummaries.find((summary) => summary.metricId === 'PEARSON_R'))
      .toEqual({ metricId: 'PEARSON_R', computationStatus: 'UNDEFINED' });
  });

  it('returns PARTIAL only when a planned case ID is absent', () => {
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS'], ['case-1']) },
      context(),
    );

    expect(report.executionStatus).toBe('PARTIAL');
    if (report.executionStatus === 'FAILED') throw new Error('Expected run report.');
    expect(report.run.caseResults).toHaveLength(1);
  });

  it('returns PARTIAL when a planned case is explicitly NOT_EXECUTED', () => {
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'NOT_EXECUTED']) },
      context(),
    );

    expect(report.executionStatus).toBe('PARTIAL');
  });

  it('returns FAILED without an EvaluationRun for a run-level failure', () => {
    const report = aggregateEvaluationReport(
      {
        kind: 'RUN_FAILED',
        failureReason: 'Runner invocation failed before a result was available.',
        attemptedDatasetIdentity: datasetIdentity,
      },
      context(),
    );

    expect(report.executionStatus).toBe('FAILED');
    if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
    expect(report.failureReason).toContain('Runner invocation failed');
    expect('run' in report).toBe(false);
  });

  it.each([
    ['duplicate planned case IDs', dataset(['case-1', 'case-1']), ['case-1', 'case-1'], 'DUPLICATE_PLANNED_CASE_ID'],
    ['duplicate result case IDs', dataset(), ['case-1', 'case-1'], 'DUPLICATE_RESULT_CASE_ID'],
    ['unexpected result case ID', dataset(), ['case-1', 'unexpected'], 'UNEXPECTED_RESULT_CASE_ID'],
  ] as const)('returns FAILED for %s', (_description, fixtureDataset, resultCaseIds, technicalFailure) => {
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS'], [...resultCaseIds], identityOf(fixtureDataset)) },
      context({ dataset: fixtureDataset }),
    );

    expect(report.executionStatus).toBe('FAILED');
    if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
    expect(report.technicalFailure).toBe(technicalFailure);
  });

  it('classifies empty planned datasets with zero results as COMPLETE', () => {
    const emptyDataset = dataset([]);
    const emptyRun = { ...run([], [], identityOf(emptyDataset)), runLevelMetricResults: undefined };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: emptyRun },
      context({ dataset: emptyDataset, referenceObservationStatuses: { datasetIdentity: identityOf(emptyDataset), observations: [] } }),
    );

    expect(report.executionStatus).toBe('COMPLETE');
  });

  it('returns FAILED with DATASET_HASH_MISMATCH when the report dataset hash is not canonical (fatal, not a warning)', () => {
    const tampered = { ...defaultDataset, datasetHash: 'tampered-hash' };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS'], undefined, identityOf(tampered)) },
      context({ dataset: tampered, referenceObservationStatuses: { datasetIdentity: identityOf(tampered), observations: [] } }),
    );

    expect(report.executionStatus).toBe('FAILED');
    if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
    expect(report.technicalFailure).toBe('DATASET_HASH_MISMATCH');
    expect('run' in report).toBe(false);

    const failedAttempt = aggregateEvaluationReport(
      { kind: 'RUN_FAILED', failureReason: 'runner threw', attemptedDatasetIdentity: identityOf(tampered) },
      context({ dataset: tampered }),
    );
    expect(failedAttempt.executionStatus === 'FAILED' && failedAttempt.technicalFailure).toBe('DATASET_HASH_MISMATCH');
  });

  it('changes the canonical hash when a case changes and is deterministic otherwise', () => {
    const original = dataset(['case-1', 'case-2']);
    const again = dataset(['case-1', 'case-2']);
    const edited = dataset(['case-1', 'case-2'], fixtureCases(['case-1', 'case-2']).map((evaluationCase, index) => (
      index === 1 ? { ...evaluationCase, referenceAnnotation: { annotationType: 'EXACT_VECTOR' as const, targetValues: { joy: 0.6 } } } : evaluationCase
    )));

    expect(original.datasetHash).toBe(again.datasetHash);
    expect(edited.datasetHash).not.toBe(original.datasetHash);
  });

  it('preserves heterogeneous annotator counts and agreements per case instead of collapsing them', () => {
    const humanCases = fixtureCases(['case-1', 'case-2', 'case-3']).map((evaluationCase, index) => ({
      ...evaluationCase,
      referenceAnnotation: {
        ...evaluationCase.referenceAnnotation,
        ...(index < 2 ? { annotatorCount: index === 0 ? 3 : 5 } : {}),
        ...(index === 1 ? { interRaterAgreement: 0.7 } : {}),
      },
    }));
    const humanDataset = { ...dataset(['case-1', 'case-2', 'case-3'], humanCases), referenceType: 'HUMAN_ANNOTATED' as const };
    const withHash = { ...humanDataset, datasetHash: computeDatasetHash(humanDataset) };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS', 'SUCCESS'], ['case-1', 'case-2', 'case-3'], identityOf(withHash)) },
      context({ dataset: withHash, referenceObservationStatuses: { datasetIdentity: identityOf(withHash), observations: [] } }),
    );

    expect(report.scientificProvenance.annotationProvenance).toBe('DEFERRED');
    expect(report.scientificProvenance.annotatorCountsByCase).toEqual([
      { caseId: 'case-1', value: 3 },
      { caseId: 'case-2', value: 5 },
    ]);
    expect(report.scientificProvenance.interRaterAgreementsByCase).toEqual([{ caseId: 'case-2', value: 0.7 }]);
  });

  it('preserves HELD_OUT role and held-out parameter versions in scientific provenance', () => {
    const heldOut = { ...defaultDataset, role: 'HELD_OUT' as const, heldOutParameterVersionIds: ['pv-7'] };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: { ...run(['SUCCESS', 'SUCCESS']), datasetRole: 'HELD_OUT', heldOutParameterVersionIds: ['pv-7'], parameterVersionId: 'pv-7' } },
      context({ dataset: heldOut }),
    );

    expect(report.scientificProvenance.datasetRole).toBe('HELD_OUT');
    expect(report.scientificProvenance.heldOutParameterVersionIds).toEqual(['pv-7']);
  });

  // Phase 6.7 — descriptive evidence level from referenceType × datasetRole only.
  describe('evidence level (Phase 6.7)', () => {
    function withReference(referenceType: EvaluationDataset['referenceType'], role: EvaluationDataset['role'] = 'DESIGN', heldOutParameterVersionIds?: string[]) {
      const base = { ...defaultDataset, referenceType, role, heldOutParameterVersionIds };
      return { ...base, datasetHash: computeDatasetHash(base) };
    }
    function reportFor(fixtureDataset: EvaluationDataset, observations: ModelObservationStatus[] = ['SUCCESS', 'SUCCESS'], parameterVersionId?: string) {
      return aggregateEvaluationReport(
        { kind: 'RUN_AVAILABLE', run: { ...run(observations, undefined, identityOf(fixtureDataset)), datasetRole: fixtureDataset.role, parameterVersionId } },
        context({ dataset: fixtureDataset, referenceObservationStatuses: { datasetIdentity: identityOf(fixtureDataset), observations: [] } }),
      );
    }

    it.each([
      ['SYNTHETIC_ORACLE', 'L2_SYNTHETIC'],
      ['EXPERT_DESIGN', 'L2_REFERENCE'],
      ['BASELINE_AGREEMENT', 'L2_REFERENCE'],
      ['HUMAN_ANNOTATED', 'L2_HUMAN_NOT_HELD_OUT'],
    ] as const)('classifies %s on a DESIGN dataset as %s', (referenceType, expected) => {
      expect(reportFor(withReference(referenceType)).scientificProvenance.evidenceLevel).toBe(expected);
    });

    it('never emits L3: HUMAN_ANNOTATED + HELD_OUT is left unclassified', () => {
      const report = reportFor(withReference('HUMAN_ANNOTATED', 'HELD_OUT', ['pv-1']), ['SUCCESS', 'SUCCESS'], 'pv-1');
      expect(report.executionStatus).toBe('COMPLETE');
      expect(report.scientificProvenance.evidenceLevel).toBeUndefined();
      expect(JSON.stringify(report)).not.toMatch(/"L3/);
      expect(report.scientificSupportLabels).toBeUndefined();
    });

    it('does not change the evidence level based on execution results or metric values', () => {
      const dataset = withReference('SYNTHETIC_ORACLE');
      const allSuccess = reportFor(dataset, ['SUCCESS', 'SUCCESS']);
      const allFailed = reportFor(dataset, ['FAILED', 'INVALID_OUTPUT']);
      const partial = reportFor(dataset, ['SUCCESS', 'NOT_EXECUTED']);
      expect(allSuccess.scientificProvenance.evidenceLevel).toBe('L2_SYNTHETIC');
      expect(allFailed.scientificProvenance.evidenceLevel).toBe('L2_SYNTHETIC');
      expect(partial.scientificProvenance.evidenceLevel).toBe('L2_SYNTHETIC');
      expect(partial.executionStatus).toBe('PARTIAL');
    });

    it('is present on FAILED reports too, derived from the same metadata', () => {
      const report = aggregateEvaluationReport(
        { kind: 'RUN_FAILED', failureReason: 'runner threw', attemptedDatasetIdentity: datasetIdentity },
        context(),
      );
      expect(report.scientificProvenance.evidenceLevel).toBe('L2_SYNTHETIC');
    });
  });

  // Phase 6.7 — contract hash and dataset integrity in the report layer.
  describe('technical provenance and dataset integrity (Phase 6.7)', () => {
    it('records the deterministic evaluation contract hash on every report shape', () => {
      const complete = aggregateEvaluationReport({ kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS']) }, context());
      const failed = aggregateEvaluationReport({ kind: 'RUN_FAILED', failureReason: 'x', attemptedDatasetIdentity: datasetIdentity }, context());
      expect(complete.evaluationContractHash).toBe(computeEvaluationContractHash());
      expect(failed.evaluationContractHash).toBe(computeEvaluationContractHash());
      expect(complete.evaluationContractHash).toMatch(/^[0-9a-f]{64}$/);
      if (complete.executionStatus !== 'FAILED') {
        expect(complete.run.evaluationContractHash).toBe(complete.evaluationContractHash);
      }
    });

    it('returns FAILED with EVALUATION_CONTRACT_HASH_MISMATCH when the run was produced under a different frozen contract', () => {
      const report = aggregateEvaluationReport(
        { kind: 'RUN_AVAILABLE', run: { ...run(['SUCCESS', 'SUCCESS']), evaluationContractHash: 'f'.repeat(64) } },
        context(),
      );
      expect(report.executionStatus).toBe('FAILED');
      if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
      expect(report.technicalFailure).toBe('EVALUATION_CONTRACT_HASH_MISMATCH');
      expect('run' in report).toBe(false);
      expect(report.evaluationContractHash).toBe(computeEvaluationContractHash());
    });

    it('returns FAILED with CASES_COUNT_MISMATCH when casesCount disagrees with cases.length', () => {
      const mismatched = { ...defaultDataset, casesCount: 5 };
      const report = aggregateEvaluationReport({ kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS']) }, context({ dataset: mismatched }));
      expect(report.executionStatus).toBe('FAILED');
      if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
      expect(report.technicalFailure).toBe('CASES_COUNT_MISMATCH');
      expect('run' in report).toBe(false);
    });

    it('returns FAILED with HELD_OUT_PARAMETER_VERSION_MISMATCH when the run parameter version is not declared held out', () => {
      const base = { ...defaultDataset, role: 'HELD_OUT' as const, heldOutParameterVersionIds: ['pv-1'] };
      const heldOut = { ...base, datasetHash: computeDatasetHash(base) };
      const report = aggregateEvaluationReport(
        { kind: 'RUN_AVAILABLE', run: { ...run(['SUCCESS', 'SUCCESS'], undefined, identityOf(heldOut)), datasetRole: 'HELD_OUT', parameterVersionId: 'pv-9' } },
        context({ dataset: heldOut, referenceObservationStatuses: { datasetIdentity: identityOf(heldOut), observations: [] } }),
      );
      expect(report.executionStatus).toBe('FAILED');
      if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
      expect(report.technicalFailure).toBe('HELD_OUT_PARAMETER_VERSION_MISMATCH');
    });

    it('does not apply HELD_OUT parameter-version validation to DESIGN datasets', () => {
      const report = aggregateEvaluationReport(
        { kind: 'RUN_AVAILABLE', run: { ...run(['SUCCESS', 'SUCCESS']), parameterVersionId: 'pv-anything' } },
        context(),
      );
      expect(report.executionStatus).toBe('COMPLETE');
    });
  });

  it('returns FAILED for run or reference-status dataset identity mismatch', () => {
    const runMismatch = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: { ...run(['SUCCESS', 'SUCCESS']), datasetIdentity: { ...datasetIdentity, datasetHash: 'wrong-run-hash' } } },
      context(),
    );
    expect(runMismatch.executionStatus).toBe('FAILED');
    if (runMismatch.executionStatus === 'FAILED') {
      expect(runMismatch.technicalFailure).toBe('DATASET_IDENTITY_MISMATCH');
    }

    const referenceMismatch = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS']) },
      context({ referenceObservationStatuses: { datasetIdentity: { ...datasetIdentity, datasetHash: 'wrong-reference-hash' }, observations: [] } }),
    );
    expect(referenceMismatch.executionStatus).toBe('FAILED');
    if (referenceMismatch.executionStatus === 'FAILED') {
      expect(referenceMismatch.technicalFailure).toBe('REFERENCE_STATUS_DATASET_IDENTITY_MISMATCH');
    }

    const failedAttemptMismatch = aggregateEvaluationReport(
      {
        kind: 'RUN_FAILED',
        failureReason: 'Failed before result creation.',
        attemptedDatasetIdentity: { ...datasetIdentity, datasetHash: 'wrong-attempt-hash' },
      },
      context(),
    );
    expect(failedAttemptMismatch.executionStatus).toBe('FAILED');
    if (failedAttemptMismatch.executionStatus === 'FAILED') {
      expect(failedAttemptMismatch.technicalFailure).toBe('DATASET_IDENTITY_MISMATCH');
    }
  });

  it('keeps SUCCESS, FAILED, INVALID_OUTPUT, and NOT_EXECUTED distinct from reference missingness', () => {
    const fourCases = dataset(['case-1', 'case-2', 'case-3', 'case-4']);
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'FAILED', 'INVALID_OUTPUT', 'NOT_EXECUTED'], ['case-1', 'case-2', 'case-3', 'case-4'], identityOf(fourCases)) },
      context({
        dataset: fourCases,
        referenceObservationStatuses: { datasetIdentity: identityOf(fourCases), observations: [{ caseId: 'case-1', targetId: 'joy', status: 'MISSING' }] },
      }),
    );

    expect(report.executionStatus).toBe('PARTIAL');
    if (report.executionStatus === 'FAILED') throw new Error('Expected run report.');
    expect(report.executionSummary).toEqual({
      totalCases: 4,
      successCount: 1,
      failedCount: 1,
      invalidOutputCount: 1,
      notExecutedCount: 1,
    });
    expect(report.missingnessSummary).toEqual({ observedCount: 0, missingCount: 1, notApplicableCount: 0, invalidCount: 0 });
  });

  it('summarizes explicitly supplied definitions while preserving metrics levels and methodology states', () => {
    const mixedCases = fixtureCases(['case-1', 'case-2']).map((evaluationCase, index) => (
      index === 1
        ? {
            ...evaluationCase,
            referenceAnnotation: { annotationType: 'RANKING' as const, targetValues: { joy: 1, fear: 2 } },
          }
        : evaluationCase
    ));
    const mixedDataset = dataset(['case-1', 'case-2'], mixedCases);
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS'], undefined, identityOf(mixedDataset)) },
      context({ dataset: mixedDataset }),
    );

    if (report.executionStatus === 'FAILED') throw new Error('Expected run report.');
    expect(report.run.caseResults[0].metricResults.map((result) => result.metricId)).toEqual(['SPEARMAN_RHO']);
    expect(report.run.runLevelMetricResults?.map((result) => result.metricId)).toEqual(['MAE', 'RMSE']);
    expect(report.metricStatusSummaries).toEqual(expect.arrayContaining([
      { metricId: 'MAE', computationStatus: 'COMPUTED' },
      { metricId: 'RMSE', computationStatus: 'INSUFFICIENT_DATA' },
      { metricId: 'PEARSON_R', computationStatus: 'NOT_COMPUTED' },
      { metricId: 'SPEARMAN_RHO', computationStatus: 'COMPUTED' },
      expect.objectContaining({ metricId: 'DIRECTIONAL_ACCURACY', computationStatus: 'METHODOLOGY_UNDEFINED' }),
    ]));
  });

  it('is deterministic and does not mutate the input run', () => {
    const fixtureRun = Object.freeze({
      ...run(['SUCCESS', 'SUCCESS']),
      caseResults: Object.freeze([...run(['SUCCESS', 'SUCCESS']).caseResults]),
    });
    const fixtureContext = context();

    const first = aggregateEvaluationReport({ kind: 'RUN_AVAILABLE', run: fixtureRun }, fixtureContext);
    const second = aggregateEvaluationReport({ kind: 'RUN_AVAILABLE', run: fixtureRun }, fixtureContext);
    expect(first).toEqual(second);
    expect(fixtureRun.caseResults).toHaveLength(2);
  });
});
