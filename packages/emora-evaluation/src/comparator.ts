import { computeDatasetHash } from './dataset/identity';
import type {
  BaselineDefinition,
  ComparatorPairingIdentity,
  ComparatorResult,
  EvaluationDataset,
  EvaluationRun,
} from './contracts';

export class ComparatorPairingError extends Error {
  readonly reason:
    | 'DATASET_IDENTITY_MISMATCH'
    | 'CASE_IDENTITY_MISMATCH'
    | 'EVALUATION_CONTRACT_MISMATCH'
    | 'DATASET_HASH_MISMATCH';

  constructor(reason: ComparatorPairingError['reason'], message: string) {
    super(message);
    this.name = 'ComparatorPairingError';
    this.reason = reason;
  }
}

function assertCaseIdentity(
  run: EvaluationRun,
  orderedCaseIds: readonly string[],
): void {
  const resultIds = run.caseResults.map((result) => result.caseId);
  if (
    resultIds.length !== orderedCaseIds.length ||
    resultIds.some((id, index) => id !== orderedCaseIds[index])
  ) {
    throw new ComparatorPairingError(
      'CASE_IDENTITY_MISMATCH',
      'Candidate or baseline case identity/order differs from the dataset.',
    );
  }
}

export function compareEvaluationRuns(
  candidateRun: EvaluationRun,
  baselineRun: EvaluationRun,
  dataset: EvaluationDataset,
  baseline: BaselineDefinition,
  comparatorId = 'descriptive-comparator',
  comparatorVersion = '1.0.0',
): ComparatorResult {
  if (
    candidateRun.datasetIdentity.datasetId !== dataset.datasetId ||
    baselineRun.datasetIdentity.datasetId !== dataset.datasetId ||
    candidateRun.datasetIdentity.datasetVersion !== dataset.datasetVersion ||
    baselineRun.datasetIdentity.datasetVersion !== dataset.datasetVersion
  ) {
    throw new ComparatorPairingError(
      'DATASET_IDENTITY_MISMATCH',
      'Candidate and baseline dataset identities must match the dataset.',
    );
  }
  const expectedHash = computeDatasetHash(dataset);
  if (
    dataset.datasetHash !== expectedHash ||
    candidateRun.datasetIdentity.datasetHash !== expectedHash ||
    baselineRun.datasetIdentity.datasetHash !== expectedHash
  ) {
    throw new ComparatorPairingError(
      'DATASET_HASH_MISMATCH',
      'Dataset or compared run hash does not match canonical dataset identity.',
    );
  }
  if (
    candidateRun.evaluationContractHash !== baselineRun.evaluationContractHash
  ) {
    throw new ComparatorPairingError(
      'EVALUATION_CONTRACT_MISMATCH',
      'Candidate and baseline evaluation contracts differ.',
    );
  }
  const orderedCaseIds = dataset.cases.map(
    (evaluationCase) => evaluationCase.caseId,
  );
  assertCaseIdentity(candidateRun, orderedCaseIds);
  assertCaseIdentity(baselineRun, orderedCaseIds);

  const pairing: ComparatorPairingIdentity = Object.freeze({
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    datasetHash: expectedHash,
    referenceType: dataset.referenceType,
    orderedCaseIds: Object.freeze([...orderedCaseIds]),
    evaluationContractHash: candidateRun.evaluationContractHash,
  });
  return Object.freeze({
    comparatorId,
    comparatorVersion,
    pairing,
    baseline,
    candidateRun,
    baselineRun,
  });
}
