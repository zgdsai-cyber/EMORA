import { hashCanonical } from '../canonicalize';
import type { EvaluationDataset, TechnicalContractViolation } from '../contracts';

export type DatasetIdentitySource = Pick<EvaluationDataset, 'datasetId' | 'datasetVersion' | 'referenceType' | 'cases'>;

/** MDS v1.0 §13: canonical identity object is exactly { datasetId, datasetVersion, referenceType, cases }. */
export function computeDatasetHash(dataset: DatasetIdentitySource): string {
  return hashCanonical({
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    referenceType: dataset.referenceType,
    cases: dataset.cases,
  });
}

export function verifyDatasetHash(dataset: DatasetIdentitySource & { readonly datasetHash: string }): boolean {
  return computeDatasetHash(dataset) === dataset.datasetHash;
}

/** Thrown when evaluation cannot proceed; the violation is fatal for the affected evidence (MDS §21). */
export class EvaluationContractViolationError extends Error {
  readonly violation: TechnicalContractViolation;

  constructor(violation: TechnicalContractViolation, message: string) {
    super(message);
    this.name = 'EvaluationContractViolationError';
    this.violation = violation;
  }
}
