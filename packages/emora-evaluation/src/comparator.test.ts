import { describe, expect, it } from 'vitest';

import { computeDatasetHash } from './dataset/identity';
import { computeEvaluationContractHash } from './contract-hash';
import { compareEvaluationRuns, ComparatorPairingError } from './comparator';
import type {
  EvaluationDataset,
  EvaluationRun,
  ConstantBaselineDefinition,
} from './contracts';

const cases = [
  {
    caseId: 'case-1',
    datasetId: 'comparator-fixture',
    input: {},
    referenceAnnotation: {
      annotationType: 'EXACT_VECTOR' as const,
      targetValues: { joy: 0.5 },
    },
  },
  {
    caseId: 'case-2',
    datasetId: 'comparator-fixture',
    input: {},
    referenceAnnotation: {
      annotationType: 'EXACT_VECTOR' as const,
      targetValues: { joy: 0.2 },
    },
  },
];
const datasetIdentity = {
  datasetId: 'comparator-fixture',
  datasetVersion: '1.0.0',
  referenceType: 'EXPERT_DESIGN' as const,
  cases,
};
const dataset: EvaluationDataset = {
  ...datasetIdentity,
  datasetHash: computeDatasetHash(datasetIdentity),
  role: 'DESIGN',
  title: 'Comparator fixture',
  description: 'Synthetic software verification fixture.',
  casesCount: cases.length,
  provenanceMetadata: {},
};
const contractHash = computeEvaluationContractHash();
const baseline: ConstantBaselineDefinition = {
  baselineId: 'constant-midpoint',
  baselineVersion: '1.0.0',
  kind: 'CONSTANT',
  values: {
    love: 0.5,
    fear: 0.5,
    nostalgia: 0.5,
    jealousy: 0.5,
    trust: 0.5,
    anger: 0.5,
    joy: 0.5,
    valence: 0,
    arousal: 0.5,
    intensity: 0.5,
  },
};

function run(
  engineCommit: string,
  caseIds = ['case-1', 'case-2'],
): EvaluationRun {
  return {
    runId: `run-${engineCommit}`,
    datasetIdentity: {
      datasetId: dataset.datasetId,
      datasetVersion: dataset.datasetVersion,
      datasetHash: dataset.datasetHash,
    },
    engineIdentity: {
      engineVersion: '1.0.0',
      engineCommit,
      runtimeContract: 'fixture-runtime',
    },
    parameterVersionId:
      engineCommit === 'candidate'
        ? 'candidate-parameter'
        : 'baseline-parameter',
    parameterVersionHash: `${engineCommit}-hash`,
    evaluationContractVersion: '6.9-fixture',
    evaluationContractHash: contractHash,
    datasetRole: 'DESIGN',
    caseResults: caseIds.map((caseId) => ({
      caseId,
      modelObservation: {
        caseId,
        status: 'SUCCESS' as const,
        observedValues: { joy: 0.5 },
      },
      metricResults: [],
    })),
    runLevelMetricResults: [],
    metricCoverage: [],
    technicalContractViolations: [],
    executionTimestamp: '2026-09-16T00:00:00.000Z',
  };
}

describe('Phase 6.9 comparator pairing', () => {
  it('keeps candidate and baseline runs separate with deterministic pairing identity', () => {
    const result = compareEvaluationRuns(
      run('candidate'),
      run('baseline'),
      dataset,
      baseline,
    );

    expect(result.candidateRun).not.toBe(result.baselineRun);
    expect(result.pairing).toEqual({
      datasetId: dataset.datasetId,
      datasetVersion: dataset.datasetVersion,
      datasetHash: dataset.datasetHash,
      referenceType: dataset.referenceType,
      orderedCaseIds: ['case-1', 'case-2'],
      evaluationContractHash: contractHash,
    });
    expect(result).not.toHaveProperty('winner');
    expect(result).not.toHaveProperty('score');
    expect(
      compareEvaluationRuns(
        run('candidate'),
        run('baseline'),
        dataset,
        baseline,
      ),
    ).toEqual(result);
  });

  it.each([
    [
      'dataset id',
      { ...datasetIdentity, datasetId: 'other' },
      'DATASET_IDENTITY_MISMATCH',
    ],
    [
      'dataset version',
      { ...datasetIdentity, datasetVersion: '2.0.0' },
      'DATASET_IDENTITY_MISMATCH',
    ],
    [
      'reference type',
      { ...datasetIdentity, referenceType: 'SYNTHETIC_ORACLE' as const },
      'DATASET_HASH_MISMATCH',
    ],
  ] as const)('rejects %s mismatch', (_label, mismatchedIdentity, reason) => {
    const mismatchedDataset = {
      ...dataset,
      ...mismatchedIdentity,
      datasetHash: computeDatasetHash(mismatchedIdentity),
    };
    try {
      compareEvaluationRuns(
        run('candidate'),
        run('baseline'),
        mismatchedDataset,
        baseline,
      );
      throw new Error('Expected comparator pairing to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ComparatorPairingError);
      expect((error as ComparatorPairingError).reason).toBe(reason);
    }
  });

  it('rejects case order and evaluation contract mismatches', () => {
    expect(() =>
      compareEvaluationRuns(
        run('candidate', ['case-2', 'case-1']),
        run('baseline'),
        dataset,
        baseline,
      ),
    ).toThrow('case identity/order differs');
    expect(() =>
      compareEvaluationRuns(
        run('candidate'),
        { ...run('baseline'), evaluationContractHash: 'different' },
        dataset,
        baseline,
      ),
    ).toThrow('evaluation contracts differ');
  });

  it('requires each run to declare the dataset id and version exactly', () => {
    expect(() =>
      compareEvaluationRuns(
        {
          ...run('candidate'),
          datasetIdentity: {
            ...run('candidate').datasetIdentity,
            datasetId: 'other-dataset',
          },
        },
        run('baseline'),
        dataset,
        baseline,
      ),
    ).toThrow('must match the dataset');
    expect(() =>
      compareEvaluationRuns(
        run('candidate'),
        {
          ...run('baseline'),
          datasetIdentity: {
            ...run('baseline').datasetIdentity,
            datasetVersion: '2.0.0',
          },
        },
        dataset,
        baseline,
      ),
    ).toThrow('must match the dataset');
  });
});
