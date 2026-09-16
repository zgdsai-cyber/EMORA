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

export interface DatasetIntegrityFailure {
  readonly violation: 'CASES_COUNT_MISMATCH' | 'HELD_OUT_PARAMETER_VERSION_MISMATCH';
  readonly message: string;
}

/**
 * Phase 6.7 integrity checks (not leakage detection). casesCount must equal
 * cases.length; on a HELD_OUT dataset that declares heldOutParameterVersionIds,
 * a supplied parameterVersionId must be in that list. Nothing is repaired.
 */
export function checkDatasetIntegrity(
  dataset: Pick<EvaluationDataset, 'datasetId' | 'casesCount' | 'cases' | 'role' | 'heldOutParameterVersionIds'>,
  parameterVersionId: string | undefined,
): DatasetIntegrityFailure | undefined {
  if (dataset.casesCount !== dataset.cases.length) {
    return {
      violation: 'CASES_COUNT_MISMATCH',
      message: `Dataset ${dataset.datasetId} declares casesCount=${dataset.casesCount} but contains ${dataset.cases.length} cases.`,
    };
  }
  if (
    dataset.role === 'HELD_OUT'
    && dataset.heldOutParameterVersionIds !== undefined
    && parameterVersionId !== undefined
    && !dataset.heldOutParameterVersionIds.includes(parameterVersionId)
  ) {
    return {
      violation: 'HELD_OUT_PARAMETER_VERSION_MISMATCH',
      message: `Parameter version ${parameterVersionId} is not declared in the HELD_OUT list of dataset ${dataset.datasetId}.`,
    };
  }
  return undefined;
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
