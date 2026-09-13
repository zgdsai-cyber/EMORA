import {
  calculateMAE,
  calculateRMSE,
  calculateSpearman,
} from '../metrics/calculations';
import { SPEARMAN_METRIC_DEFINITION } from '../metrics/definitions';
import type {
  EvaluationCase,
  EvaluationCaseResult,
  EvaluationRequest,
  EvaluationRun,
  MetricResult,
  ModelObservation,
} from '../contracts';

export interface ExecutionMetadata {
  readonly runId: string;
  readonly executionTimestamp: string;
}

type NumericValues = Readonly<Record<string, number>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericValues(value: unknown): NumericValues | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested !== 'number' || !Number.isFinite(nested)) return undefined;
    result[key] = nested;
  }
  return result;
}

function observe(
  evaluationCase: EvaluationCase,
  request: EvaluationRequest,
  executionTimestamp: string,
): ModelObservation {
  try {
    const result = request.engine.provider.transition(
      evaluationCase.input as Parameters<typeof request.engine.provider.transition>[0],
    );
    if (!isRecord(result) || !isRecord(result.nextState)) {
      return { caseId: evaluationCase.caseId, status: 'INVALID_OUTPUT', failureReason: 'Provider result is missing nextState.' };
    }
    const emotionVector = numericValues(result.nextState.emotionVector);
    const dimensions = numericValues(result.nextState.dimensions);
    if (!emotionVector || !dimensions || typeof result.nextState.timestamp !== 'string') {
      return { caseId: evaluationCase.caseId, status: 'INVALID_OUTPUT', failureReason: 'Provider result has invalid state structure or non-finite values.' };
    }
    if (result.confidenceAdjustment !== undefined && !Number.isFinite(result.confidenceAdjustment)) {
      return { caseId: evaluationCase.caseId, status: 'INVALID_OUTPUT', failureReason: 'Provider result has a non-finite confidenceAdjustment.' };
    }
    return {
      caseId: evaluationCase.caseId,
      status: 'SUCCESS',
      observedValues: Object.freeze({
        ...emotionVector,
        ...dimensions,
        ...(result.confidenceAdjustment === undefined
          ? {}
          : { confidenceAdjustment: result.confidenceAdjustment }),
      }),
      executionTimestamp,
    };
  } catch (error) {
    return {
      caseId: evaluationCase.caseId,
      status: 'FAILED',
      failureReason: error instanceof Error ? error.message : 'Provider execution failed.',
    };
  }
}

function pairedValues(
  observedValues: NumericValues,
  targetValues: Readonly<Record<string, unknown>>,
): { observed: number[]; target: number[]; dimensions: string[] } | undefined {
  const dimensions = Object.keys(targetValues).sort();
  if (dimensions.length === 0) return undefined;
  const observed: number[] = [];
  const target: number[] = [];
  for (const dimension of dimensions) {
    const reference = targetValues[dimension];
    const observation = observedValues[dimension];
    if (typeof reference !== 'number' || !Number.isFinite(reference) || observation === undefined) {
      return undefined;
    }
    observed.push(observation);
    target.push(reference);
  }
  return { observed, target, dimensions };
}

/** Case-level metrics only: Spearman (Model A, intra-case ranking). MAE/RMSE are run-level (see buildFixedDimensionRecords). */
function metricResults(
  evaluationCase: EvaluationCase,
  observation: ModelObservation,
): readonly MetricResult[] {
  if (evaluationCase.referenceAnnotation.annotationType !== 'RANKING') return [];
  if (observation.status !== 'SUCCESS' || !observation.observedValues) return [];
  const observedValues = numericValues(observation.observedValues);
  if (!observedValues) return [];
  const paired = pairedValues(observedValues, evaluationCase.referenceAnnotation.targetValues);
  if (!paired) return [];

  return Object.freeze([
    calculateSpearman(paired.target, paired.observed, SPEARMAN_METRIC_DEFINITION.targetType),
  ]);
}

function freezeCaseResult(
  evaluationCase: EvaluationCase,
  observation: ModelObservation,
): EvaluationCaseResult {
  return Object.freeze({
    caseId: evaluationCase.caseId,
    modelObservation: Object.freeze(observation),
    metricResults: Object.freeze([...metricResults(evaluationCase, observation)]),
  });
}

/**
 * MAE/RMSE (Model B): sampling unit is one EvaluationCase per observation, for one
 * fixed target dimension, aggregated across every EXACT_VECTOR case in the dataset.
 * Only SUCCESS observations with a valid finite reference and observed value for a
 * given dimension contribute to that dimension's series; nothing is imputed.
 * Each dimension is filtered independently so a case missing one dimension does not
 * invalidate the sample for any other dimension (e.g. a case with only 'joy' still
 * contributes to the 'joy' series without affecting the 'fear' series).
 */
function buildDimensionSeries(
  cases: readonly EvaluationCase[],
  observationsByCaseId: ReadonlyMap<string, ModelObservation>,
): ReadonlyMap<string, { readonly reference: number[]; readonly model: number[] }> {
  const seriesByDimension = new Map<string, { reference: number[]; model: number[] }>();

  for (const evaluationCase of cases) {
    if (evaluationCase.referenceAnnotation.annotationType !== 'EXACT_VECTOR') continue;
    const observation = observationsByCaseId.get(evaluationCase.caseId);
    if (!observation || observation.status !== 'SUCCESS' || !observation.observedValues) continue;
    const observedValues = numericValues(observation.observedValues);
    if (!observedValues) continue;

    for (const [dimension, reference] of Object.entries(evaluationCase.referenceAnnotation.targetValues)) {
      const observedValue = observedValues[dimension];
      if (typeof reference !== 'number' || !Number.isFinite(reference) || observedValue === undefined) continue;
      const series = seriesByDimension.get(dimension) ?? { reference: [], model: [] };
      series.reference.push(reference);
      series.model.push(observedValue);
      seriesByDimension.set(dimension, series);
    }
  }

  return seriesByDimension;
}

function runLevelMetricResults(
  cases: readonly EvaluationCase[],
  observationsByCaseId: ReadonlyMap<string, ModelObservation>,
): readonly MetricResult[] | undefined {
  const hasExactVectorCase = cases.some((evaluationCase) => evaluationCase.referenceAnnotation.annotationType === 'EXACT_VECTOR');
  if (!hasExactVectorCase) return undefined;

  const seriesByDimension = buildDimensionSeries(cases, observationsByCaseId);
  const dimensions = Array.from(seriesByDimension.keys()).sort();
  const results = dimensions.flatMap((dimension) => {
    const series = seriesByDimension.get(dimension)!;
    return [
      calculateMAE(series.reference, series.model, dimension),
      calculateRMSE(series.reference, series.model, dimension),
    ];
  });
  return results.length > 0 ? Object.freeze(results) : undefined;
}

export function runBehavioralEvaluation(
  request: EvaluationRequest,
  metadata: ExecutionMetadata,
): EvaluationRun {
  const observations = request.dataset.cases.map((evaluationCase) =>
    observe(evaluationCase, request, metadata.executionTimestamp));
  const observationsByCaseId = new Map(
    request.dataset.cases.map((evaluationCase, index) => [evaluationCase.caseId, observations[index]]),
  );
  const caseResults = request.dataset.cases.map((evaluationCase, index) =>
    freezeCaseResult(evaluationCase, observations[index]));

  return Object.freeze({
    runId: metadata.runId,
    datasetIdentity: Object.freeze({
      datasetId: request.dataset.datasetId,
      datasetVersion: request.dataset.datasetVersion,
      datasetHash: request.dataset.datasetHash,
    }),
    engineIdentity: Object.freeze({
      engineVersion: request.engine.engineVersion,
      engineCommit: request.engine.engineCommit,
      runtimeContract: request.engine.runtimeContract,
    }),
    parameterVersionId: request.parameterVersionId,
    parameterVersionHash: request.parameterVersionHash,
    evaluationContractVersion: request.evaluationContractVersion,
    configurationHash: request.configurationHash,
    caseResults: Object.freeze(caseResults),
    runLevelMetricResults: runLevelMetricResults(request.dataset.cases, observationsByCaseId),
    executionTimestamp: metadata.executionTimestamp,
  });
}
