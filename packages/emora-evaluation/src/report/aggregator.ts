import type {
  CaseScalarProvenance,
  DataObservationStatus,
  EvaluationExecutionSummary,
  EvaluationMissingnessSummary,
  EvaluationReport,
  EvaluationReportContext,
  EvaluationReportInput,
  MetricComputationStatus,
  MetricDefinition,
  MetricResult,
  MetricStatusSummary,
  ScientificEvidenceProvenance,
  TechnicalContractViolation,
} from '../contracts';
import { verifyDatasetHash } from '../dataset/identity';

function sameDatasetIdentity(
  left: { readonly datasetId: string; readonly datasetVersion: string; readonly datasetHash: string },
  right: { readonly datasetId: string; readonly datasetVersion: string; readonly datasetHash: string },
): boolean {
  return left.datasetId === right.datasetId
    && left.datasetVersion === right.datasetVersion
    && left.datasetHash === right.datasetHash;
}

function suppliedPerCase(
  context: EvaluationReportContext,
  select: (annotation: EvaluationReportContext['dataset']['cases'][number]['referenceAnnotation']) => number | undefined,
): readonly CaseScalarProvenance[] {
  return Object.freeze(context.dataset.cases.flatMap((evaluationCase) => {
    const value = select(evaluationCase.referenceAnnotation);
    return value === undefined ? [] : [Object.freeze({ caseId: evaluationCase.caseId, value })];
  }));
}

function scientificProvenance(context: EvaluationReportContext): ScientificEvidenceProvenance {
  return Object.freeze({
    referenceType: context.dataset.referenceType,
    datasetRole: context.dataset.role,
    heldOutParameterVersionIds: context.dataset.heldOutParameterVersionIds
      ? Object.freeze([...context.dataset.heldOutParameterVersionIds])
      : undefined,
    annotationProvenance: context.dataset.referenceType === 'HUMAN_ANNOTATED' ? 'DEFERRED' : undefined,
    annotatorCountsByCase: suppliedPerCase(context, (annotation) => annotation.annotatorCount),
    interRaterAgreementsByCase: suppliedPerCase(context, (annotation) => annotation.interRaterAgreement),
    datasetProvenanceMetadata: context.dataset.provenanceMetadata,
  });
}

function executionSummary(run: EvaluationReportInput & { readonly kind: 'RUN_AVAILABLE' }): EvaluationExecutionSummary {
  let successCount = 0;
  let failedCount = 0;
  let invalidOutputCount = 0;
  let notExecutedCount = 0;
  for (const caseResult of run.run.caseResults) {
    switch (caseResult.modelObservation.status) {
      case 'SUCCESS': successCount++; break;
      case 'FAILED': failedCount++; break;
      case 'INVALID_OUTPUT': invalidOutputCount++; break;
      case 'NOT_EXECUTED': notExecutedCount++; break;
    }
  }
  return Object.freeze({
    totalCases: run.run.caseResults.length,
    successCount,
    failedCount,
    invalidOutputCount,
    notExecutedCount,
  });
}

function missingnessSummary(
  statuses: readonly { readonly status: DataObservationStatus }[],
): EvaluationMissingnessSummary {
  let observedCount = 0;
  let missingCount = 0;
  let notApplicableCount = 0;
  let invalidCount = 0;
  for (const entry of statuses) {
    switch (entry.status) {
      case 'OBSERVED': observedCount++; break;
      case 'MISSING': missingCount++; break;
      case 'NOT_APPLICABLE': notApplicableCount++; break;
      case 'INVALID': invalidCount++; break;
    }
  }
  return Object.freeze({ observedCount, missingCount, notApplicableCount, invalidCount });
}

function containsAssumption(definition: MetricDefinition, prefix: string): string | undefined {
  return definition.assumptions.find((assumption) => assumption.startsWith(prefix));
}

function metricResultsFor(
  run: EvaluationReportInput & { readonly kind: 'RUN_AVAILABLE' },
  metricId: string,
): Readonly<{ readonly caseLevel: readonly MetricResult[]; readonly runLevel: readonly MetricResult[] }> {
  return {
    caseLevel: run.run.caseResults
      .flatMap((caseResult) => caseResult.metricResults)
      .filter((result) => result.metricId === metricId),
    runLevel: (run.run.runLevelMetricResults ?? [])
      .filter((result) => result.metricId === metricId),
  };
}

function metricStatusSummaries(
  run: EvaluationReportInput & { readonly kind: 'RUN_AVAILABLE' },
  context: EvaluationReportContext,
): readonly MetricStatusSummary[] {
  return Object.freeze(context.metricDefinitions.map((definition): MetricStatusSummary => {
    const deferred = containsAssumption(definition, 'DEFERRED — REQUIRES METHODOLOGICAL DECISION.');
    if (deferred) {
      return { metricId: definition.metricId, computationStatus: 'METHODOLOGY_DEFERRED', methodologicalNote: deferred };
    }
    const undefinedMethodology = containsAssumption(definition, 'UNDEFINED — REQUIRES METHODOLOGICAL DECISION.');
    if (undefinedMethodology) {
      return { metricId: definition.metricId, computationStatus: 'METHODOLOGY_UNDEFINED', methodologicalNote: undefinedMethodology };
    }
    const applicable = context.dataset.cases.some((evaluationCase) =>
      evaluationCase.referenceAnnotation.annotationType === definition.annotationType);
    if (!applicable) return { metricId: definition.metricId, computationStatus: 'NOT_APPLICABLE' };

    const results = metricResultsFor(run, definition.metricId);
    if (
      results.caseLevel.some((result) => result.status === 'COMPUTED')
      || results.runLevel.some((result) => result.status === 'COMPUTED')
    ) {
      return { metricId: definition.metricId, computationStatus: 'COMPUTED' };
    }
    if (
      results.caseLevel.some((result) => result.status === 'INSUFFICIENT_DATA')
      || results.runLevel.some((result) => result.status === 'INSUFFICIENT_DATA')
    ) {
      return { metricId: definition.metricId, computationStatus: 'INSUFFICIENT_DATA' };
    }
    return { metricId: definition.metricId, computationStatus: 'NOT_COMPUTED' as MetricComputationStatus };
  }));
}

function reportFailure(
  context: EvaluationReportContext,
  attemptedDatasetIdentity: { readonly datasetId: string; readonly datasetVersion: string; readonly datasetHash: string },
  failureReason: string,
  technicalFailure?: TechnicalContractViolation,
): EvaluationReport {
  return Object.freeze({
    reportId: context.reportId,
    executionStatus: 'FAILED',
    failureReason,
    attemptedDatasetIdentity,
    technicalFailure,
    scientificProvenance: scientificProvenance(context),
    deferredMethodologicalNotes: Object.freeze([...(context.deferredMethodologicalNotes ?? [])]),
    counterexampleReferences: context.counterexampleReferences
      ? Object.freeze([...context.counterexampleReferences])
      : undefined,
  });
}

function caseIdViolation(
  plannedCaseIds: readonly string[],
  resultCaseIds: readonly string[],
): TechnicalContractViolation | undefined {
  if (new Set(plannedCaseIds).size !== plannedCaseIds.length) return 'DUPLICATE_PLANNED_CASE_ID';
  if (new Set(resultCaseIds).size !== resultCaseIds.length) return 'DUPLICATE_RESULT_CASE_ID';
  const planned = new Set(plannedCaseIds);
  if (resultCaseIds.some((caseId) => !planned.has(caseId))) return 'UNEXPECTED_RESULT_CASE_ID';
  return undefined;
}

export function aggregateEvaluationReport(
  input: EvaluationReportInput,
  context: EvaluationReportContext,
): EvaluationReport {
  const contextIdentity = {
    datasetId: context.dataset.datasetId,
    datasetVersion: context.dataset.datasetVersion,
    datasetHash: context.dataset.datasetHash,
  };
  if (!verifyDatasetHash(context.dataset)) {
    return reportFailure(context, contextIdentity, 'Report dataset hash does not match its canonical identity.', 'DATASET_HASH_MISMATCH');
  }

  if (input.kind === 'RUN_FAILED') {
    if (!sameDatasetIdentity(input.attemptedDatasetIdentity, context.dataset)) {
      return reportFailure(context, input.attemptedDatasetIdentity, 'Failed evaluation dataset identity does not match the report dataset.', 'DATASET_IDENTITY_MISMATCH');
    }
    if (!sameDatasetIdentity(context.referenceObservationStatuses.datasetIdentity, context.dataset)) {
      return reportFailure(context, input.attemptedDatasetIdentity, 'Reference observation statuses do not match the report dataset.', 'REFERENCE_STATUS_DATASET_IDENTITY_MISMATCH');
    }
    return reportFailure(
      context,
      input.attemptedDatasetIdentity,
      input.failureReason,
      input.technicalFailure,
    );
  }

  const run = input.run;
  if (!sameDatasetIdentity(run.datasetIdentity, context.dataset)) {
    return reportFailure(context, run.datasetIdentity, 'EvaluationRun dataset identity does not match the report dataset.', 'DATASET_IDENTITY_MISMATCH');
  }
  if (!sameDatasetIdentity(context.referenceObservationStatuses.datasetIdentity, context.dataset)) {
    return reportFailure(context, run.datasetIdentity, 'Reference observation statuses do not match the report dataset.', 'REFERENCE_STATUS_DATASET_IDENTITY_MISMATCH');
  }

  const plannedCaseIds = context.dataset.cases.map((evaluationCase) => evaluationCase.caseId);
  const resultCaseIds = run.caseResults.map((caseResult) => caseResult.caseId);
  const violation = caseIdViolation(plannedCaseIds, resultCaseIds);
  if (violation) {
    return reportFailure(context, run.datasetIdentity, `Evaluation case identity violation: ${violation}.`, violation);
  }

  const hasUnexecutedCase = run.caseResults.some(
    (caseResult) => caseResult.modelObservation.status === 'NOT_EXECUTED',
  );
  const status = !hasUnexecutedCase && plannedCaseIds.every((caseId) => resultCaseIds.includes(caseId))
    ? 'COMPLETE'
    : 'PARTIAL';
  return Object.freeze({
    reportId: context.reportId,
    executionStatus: status,
    run,
    executionSummary: executionSummary(input),
    missingnessSummary: missingnessSummary(context.referenceObservationStatuses.observations),
    metricStatusSummaries: metricStatusSummaries(input, context),
    scientificProvenance: scientificProvenance(context),
    deferredMethodologicalNotes: Object.freeze([...(context.deferredMethodologicalNotes ?? [])]),
    counterexampleReferences: context.counterexampleReferences
      ? Object.freeze([...context.counterexampleReferences])
      : undefined,
  });
}
