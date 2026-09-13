import { describe, expect, it } from 'vitest';

import type {
  EvaluationDataset,
  EvaluationReportContext,
  EvaluationRun,
  MetricResult,
  ModelObservationStatus,
} from '../contracts';
import {
  DIRECTIONAL_ACCURACY_DEFINITION,
  MAE_METRIC_DEFINITION,
  PEARSON_METRIC_DEFINITION,
  RMSE_METRIC_DEFINITION,
  SPEARMAN_METRIC_DEFINITION,
} from '../metrics/definitions';
import { aggregateEvaluationReport } from './aggregator';

const datasetIdentity = {
  datasetId: 'report-fixture-dataset',
  datasetVersion: '1.0.0',
  datasetHash: 'report-fixture-hash',
};

function dataset(caseIds = ['case-1', 'case-2']): EvaluationDataset {
  return {
    ...datasetIdentity,
    referenceType: 'SYNTHETIC_ORACLE',
    title: 'Software report fixture',
    description: 'Synthetic fixture for report aggregation only.',
    casesCount: caseIds.length,
    cases: caseIds.map((caseId) => ({
      caseId,
      datasetId: datasetIdentity.datasetId,
      input: {},
      referenceAnnotation: { annotationType: 'EXACT_VECTOR', targetValues: { joy: 0.5 } },
    })),
    provenanceMetadata: { fixture: true },
  };
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
): EvaluationRun {
  return {
    runId: 'run-fixture',
    datasetIdentity,
    engineIdentity: { engineVersion: '1.0.0', engineCommit: 'fixture-commit', runtimeContract: 'fixture-runtime' },
    evaluationContractVersion: '6.5-b-fixture',
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
    executionTimestamp: '2026-09-13T00:00:00.000Z',
  };
}

function context(overrides: Partial<EvaluationReportContext> = {}): EvaluationReportContext {
  return {
    reportId: 'report-fixture',
    dataset: dataset(),
    metricDefinitions: [
      MAE_METRIC_DEFINITION,
      RMSE_METRIC_DEFINITION,
      PEARSON_METRIC_DEFINITION,
      SPEARMAN_METRIC_DEFINITION,
      DIRECTIONAL_ACCURACY_DEFINITION,
    ],
    referenceObservationStatuses: {
      datasetIdentity,
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
    expect(report.run).toBeDefined();
    expect(report.counterexampleReferences).toBeUndefined();
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
    ['duplicate planned case IDs', dataset(['case-1', 'case-1']), run(['SUCCESS', 'SUCCESS']), 'DUPLICATE_PLANNED_CASE_ID'],
    ['duplicate result case IDs', dataset(), run(['SUCCESS', 'SUCCESS'], ['case-1', 'case-1']), 'DUPLICATE_RESULT_CASE_ID'],
    ['unexpected result case ID', dataset(), run(['SUCCESS', 'SUCCESS'], ['case-1', 'unexpected']), 'UNEXPECTED_RESULT_CASE_ID'],
  ])('returns FAILED for %s', (_description, fixtureDataset, fixtureRun, technicalFailure) => {
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: fixtureRun },
      context({ dataset: fixtureDataset }),
    );

    expect(report.executionStatus).toBe('FAILED');
    if (report.executionStatus !== 'FAILED') throw new Error('Expected failed report.');
    expect(report.technicalFailure).toBe(technicalFailure);
  });

  it('classifies empty planned datasets with zero results as COMPLETE', () => {
    const emptyDataset = dataset([]);
    const emptyRun = { ...run([], []), runLevelMetricResults: undefined };
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: emptyRun },
      context({ dataset: emptyDataset, referenceObservationStatuses: { datasetIdentity, observations: [] } }),
    );

    expect(report.executionStatus).toBe('COMPLETE');
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
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'FAILED', 'INVALID_OUTPUT', 'NOT_EXECUTED'], ['case-1', 'case-2', 'case-3', 'case-4']) },
      context({
        dataset: dataset(['case-1', 'case-2', 'case-3', 'case-4']),
        referenceObservationStatuses: { datasetIdentity, observations: [{ caseId: 'case-1', targetId: 'joy', status: 'MISSING' }] },
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
    const fixtureDataset = dataset().cases.map((evaluationCase, index) => (
      index === 1
        ? {
            ...evaluationCase,
            referenceAnnotation: { annotationType: 'RANKING' as const, targetValues: { joy: 2, fear: 1 } },
          }
        : evaluationCase
    ));
    const report = aggregateEvaluationReport(
      { kind: 'RUN_AVAILABLE', run: run(['SUCCESS', 'SUCCESS']) },
      context({ dataset: { ...dataset(), cases: fixtureDataset } }),
    );

    if (report.executionStatus === 'FAILED') throw new Error('Expected run report.');
    expect(report.run.caseResults[0].metricResults.map((result) => result.metricId)).toEqual(['SPEARMAN_RHO']);
    expect(report.run.runLevelMetricResults?.map((result) => result.metricId)).toEqual(['MAE', 'RMSE']);
    expect(report.metricStatusSummaries).toEqual(expect.arrayContaining([
      { metricId: 'MAE', computationStatus: 'COMPUTED' },
      { metricId: 'RMSE', computationStatus: 'INSUFFICIENT_DATA' },
      expect.objectContaining({ metricId: 'PEARSON_R', computationStatus: 'METHODOLOGY_DEFERRED' }),
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
