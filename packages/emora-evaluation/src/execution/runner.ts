import {
  calculateMAE,
  calculateRMSE,
  calculateSpearman,
  isValidCompetitionRanking,
} from '../metrics/calculations';
import { SPEARMAN_METRIC_DEFINITION } from '../metrics/definitions';
import { classifyDimension, SPEARMAN_RANKING_PROTOCOL } from '../dimensions/registry';
import { checkDatasetIntegrity, EvaluationContractViolationError, verifyDatasetHash } from '../dataset/identity';
import { computeEvaluationContractHash } from '../contract-hash';
import type {
  CoverageExclusion,
  CoverageExclusionReason,
  EvaluationCase,
  EvaluationRequest,
  EvaluationRun,
  MetricCoverage,
  MetricObservationalUnit,
  MetricResult,
  ModelObservation,
  ModelObservationStatus,
  RunTechnicalViolation,
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

function executionExclusion(status: ModelObservationStatus): CoverageExclusionReason | undefined {
  switch (status) {
    case 'SUCCESS': return undefined;
    case 'FAILED': return 'EXECUTION_FAILED';
    case 'INVALID_OUTPUT': return 'EXECUTION_INVALID_OUTPUT';
    case 'NOT_EXECUTED': return 'EXECUTION_NOT_EXECUTED';
  }
}

function referenceExclusion(reference: unknown): CoverageExclusionReason | undefined {
  if (reference === undefined || reference === null) return 'REFERENCE_MISSING';
  if (typeof reference !== 'number' || !Number.isFinite(reference)) return 'REFERENCE_INVALID';
  return undefined;
}

function coverage(
  metricId: string,
  unit: MetricObservationalUnit,
  dimension: string,
  planned: number,
  eligible: number,
  contributing: number,
  exclusions: readonly CoverageExclusion[],
): MetricCoverage {
  return Object.freeze({
    metricId,
    unit,
    dimension,
    planned,
    eligible,
    contributing,
    excluded: exclusions.length,
    exclusions: Object.freeze([...exclusions]),
  });
}

interface RankingEvaluation {
  readonly resultsByCaseId: ReadonlyMap<string, readonly MetricResult[]>;
  readonly coverage: MetricCoverage;
}

/**
 * Spearman (Model A, MDS §5.2/§6, A1): unit is (case, ranking-space). Ranking space is
 * EMOTION only; reference targetValues are competition ranks under RANK_1_IS_HIGHEST
 * (ties allowed) and become average ranks for Spearman; model scores become fractional
 * ranks with rank 1 for the highest score. Eligibility is checked in order: ranking-space
 * membership, reference validity (finite, then competition encoding), minimum n,
 * execution status, model/reference pairing.
 * Only eligible units are calculated; every other planned unit is recorded in coverage.
 */
function evaluateRankingCases(
  cases: readonly EvaluationCase[],
  observationsByCaseId: ReadonlyMap<string, ModelObservation>,
  violations: RunTechnicalViolation[],
): RankingEvaluation {
  const metricId = SPEARMAN_METRIC_DEFINITION.metricId;
  const rankingSpace = SPEARMAN_RANKING_PROTOCOL.rankingSpace;
  const resultsByCaseId = new Map<string, readonly MetricResult[]>();
  const exclusions: CoverageExclusion[] = [];
  let planned = 0;
  let eligible = 0;
  let contributing = 0;

  for (const evaluationCase of cases) {
    if (evaluationCase.referenceAnnotation.annotationType !== 'RANKING') continue;
    planned++;
    const caseId = evaluationCase.caseId;
    const targetValues = evaluationCase.referenceAnnotation.targetValues;
    const dimensions = Object.keys(targetValues).sort();
    if (dimensions.length === 0) {
      exclusions.push({ caseId, reason: 'REFERENCE_MISSING', detail: 'Ranking reference declares no dimensions.' });
      continue;
    }

    const unknown = dimensions.find((dimension) => classifyDimension(dimension) === undefined);
    if (unknown !== undefined) {
      violations.push({ violation: 'UNKNOWN_DIMENSION', caseId, source: 'REFERENCE', dimension: unknown, metricId });
      exclusions.push({ caseId, reason: 'UNKNOWN_DIMENSION', detail: unknown });
      continue;
    }
    const foreign = dimensions.find((dimension) => classifyDimension(dimension)?.semanticClass !== rankingSpace);
    if (foreign !== undefined) {
      violations.push({ violation: 'MIXED_SEMANTIC_SPACE', caseId, source: 'REFERENCE', dimension: foreign, metricId });
      exclusions.push({ caseId, reason: 'MIXED_SEMANTIC_SPACE', detail: foreign });
      continue;
    }

    const referenceRanks: number[] = [];
    let referenceProblem: CoverageExclusion | undefined;
    for (const dimension of dimensions) {
      const reference = targetValues[dimension];
      const reason = referenceExclusion(reference);
      if (reason) { referenceProblem = { caseId, reason, detail: dimension }; break; }
      referenceRanks.push(reference as number);
    }
    if (referenceProblem) { exclusions.push(referenceProblem); continue; }
    // MDS §6.2 (A1): the whole reference vector must be a valid competition ranking; ties allowed.
    if (!isValidCompetitionRanking(referenceRanks)) {
      exclusions.push({ caseId, reason: 'REFERENCE_INVALID', detail: `Reference ranks [${referenceRanks.join(',')}] are not a valid competition ranking for n=${dimensions.length} under RANK_1_IS_HIGHEST.` });
      continue;
    }

    if (dimensions.length < SPEARMAN_RANKING_PROTOCOL.minimumN) {
      exclusions.push({ caseId, reason: 'INSUFFICIENT_DATA', detail: `n=${dimensions.length} < ${SPEARMAN_RANKING_PROTOCOL.minimumN}` });
      continue;
    }

    const observation = observationsByCaseId.get(caseId);
    const executionReason = observation ? executionExclusion(observation.status) : 'EXECUTION_NOT_EXECUTED';
    if (executionReason) { exclusions.push({ caseId, reason: executionReason }); continue; }
    const observedValues = numericValues(observation?.observedValues);
    if (!observedValues) { exclusions.push({ caseId, reason: 'EXECUTION_INVALID_OUTPUT' }); continue; }
    const absent = dimensions.find((dimension) => observedValues[dimension] === undefined);
    if (absent !== undefined) { exclusions.push({ caseId, reason: 'MODEL_DIMENSION_ABSENT', detail: absent }); continue; }

    eligible++;
    // calculateSpearman applies exactly one fractional-rank transformation per side:
    // reference competition ranks -> average ranks; negated model scores -> fractional ranks (rank 1 = highest score).
    const negatedModelScores = dimensions.map((dimension) => -observedValues[dimension]);
    const result = calculateSpearman(referenceRanks, negatedModelScores, rankingSpace);
    resultsByCaseId.set(caseId, Object.freeze([result]));
    if (result.status === 'COMPUTED') {
      contributing++;
    } else {
      exclusions.push({ caseId, reason: 'METRIC_INVALID', detail: result.failureReason });
    }
  }

  return {
    resultsByCaseId,
    coverage: coverage(metricId, 'CASE_RANKING_SPACE', rankingSpace, planned, eligible, contributing, exclusions),
  };
}

interface FixedDimensionEvaluation {
  readonly results: readonly MetricResult[] | undefined;
  readonly coverage: readonly MetricCoverage[];
}

interface DimensionSeries {
  readonly reference: number[];
  readonly model: number[];
  readonly eligibleCaseIds: string[];
  readonly exclusions: CoverageExclusion[];
  planned: number;
  behavioralTarget: boolean;
}

/**
 * MAE/RMSE (Model B, MDS §5.1/§8.1): unit is (case, dimension), one fixed dimension
 * across every EXACT_VECTOR case. Eligibility order: registry classification
 * (unknown → violation; COMPUTATIONAL → excluded), reference validity, execution
 * status, model/reference pairing. Each dimension is filtered independently; nothing
 * is imputed. A MetricResult is emitted only for behavioral-target dimensions.
 */
function evaluateFixedDimensions(
  cases: readonly EvaluationCase[],
  observationsByCaseId: ReadonlyMap<string, ModelObservation>,
  violations: RunTechnicalViolation[],
): FixedDimensionEvaluation {
  const seriesByDimension = new Map<string, DimensionSeries>();
  let hasExactVectorCase = false;

  for (const evaluationCase of cases) {
    if (evaluationCase.referenceAnnotation.annotationType !== 'EXACT_VECTOR') continue;
    hasExactVectorCase = true;
    const caseId = evaluationCase.caseId;
    const observation = observationsByCaseId.get(caseId);
    const observedValues = observation?.status === 'SUCCESS' ? numericValues(observation.observedValues) : undefined;

    for (const [dimension, reference] of Object.entries(evaluationCase.referenceAnnotation.targetValues)) {
      const definition = classifyDimension(dimension);
      const series = seriesByDimension.get(dimension)
        ?? { reference: [], model: [], eligibleCaseIds: [], exclusions: [], planned: 0, behavioralTarget: definition?.behavioralTarget === true };
      seriesByDimension.set(dimension, series);
      series.planned++;

      if (!definition) {
        violations.push({ violation: 'UNKNOWN_DIMENSION', caseId, source: 'REFERENCE', dimension, metricId: 'MAE' });
        violations.push({ violation: 'UNKNOWN_DIMENSION', caseId, source: 'REFERENCE', dimension, metricId: 'RMSE' });
        series.exclusions.push({ caseId, reason: 'UNKNOWN_DIMENSION' });
        continue;
      }
      if (!definition.behavioralTarget) {
        series.exclusions.push({ caseId, reason: 'COMPUTATIONAL_DIMENSION_EXCLUDED' });
        continue;
      }
      const referenceReason = referenceExclusion(reference);
      if (referenceReason) { series.exclusions.push({ caseId, reason: referenceReason }); continue; }
      const executionReason = observation ? executionExclusion(observation.status) : 'EXECUTION_NOT_EXECUTED';
      if (executionReason) { series.exclusions.push({ caseId, reason: executionReason }); continue; }
      if (!observedValues) { series.exclusions.push({ caseId, reason: 'EXECUTION_INVALID_OUTPUT' }); continue; }
      const observedValue = observedValues[dimension];
      if (observedValue === undefined) { series.exclusions.push({ caseId, reason: 'MODEL_DIMENSION_ABSENT' }); continue; }

      series.reference.push(reference as number);
      series.model.push(observedValue);
      series.eligibleCaseIds.push(caseId);
    }
  }

  if (!hasExactVectorCase) return { results: undefined, coverage: [] };

  const results: MetricResult[] = [];
  const coverageEntries: MetricCoverage[] = [];
  for (const dimension of Array.from(seriesByDimension.keys()).sort()) {
    const series = seriesByDimension.get(dimension)!;
    const eligible = series.reference.length;
    if (!series.behavioralTarget) {
      for (const metricId of ['MAE', 'RMSE']) {
        coverageEntries.push(coverage(metricId, 'CASE_DIMENSION', dimension, series.planned, 0, 0, series.exclusions));
      }
      continue;
    }
    const computed = [
      calculateMAE(series.reference, series.model, dimension),
      calculateRMSE(series.reference, series.model, dimension),
    ];
    for (const result of computed) {
      const contributing = result.status === 'COMPUTED' ? result.sampleSize : 0;
      const exclusions = result.status === 'COMPUTED'
        ? series.exclusions
        : [...series.exclusions, ...series.eligibleCaseIds.map((caseId) => ({
            caseId,
            reason: (result.status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'METRIC_INVALID') as CoverageExclusionReason,
            detail: result.failureReason,
          }))];
      const entry = coverage(result.metricId, 'CASE_DIMENSION', dimension, series.planned, eligible, contributing, exclusions);
      coverageEntries.push(entry);
      results.push(result);
    }
  }
  return { results: results.length > 0 ? Object.freeze(results) : undefined, coverage: coverageEntries };
}

export function runBehavioralEvaluation(
  request: EvaluationRequest,
  metadata: ExecutionMetadata,
): EvaluationRun {
  if (!verifyDatasetHash(request.dataset)) {
    throw new EvaluationContractViolationError(
      'DATASET_HASH_MISMATCH',
      `Dataset ${request.dataset.datasetId}@${request.dataset.datasetVersion} hash does not match its canonical identity.`,
    );
  }
  const integrity = checkDatasetIntegrity(request.dataset, request.parameterVersionId);
  if (integrity) {
    throw new EvaluationContractViolationError(integrity.violation, integrity.message);
  }

  const observations = request.dataset.cases.map((evaluationCase) =>
    observe(evaluationCase, request, metadata.executionTimestamp));
  const observationsByCaseId = new Map(
    request.dataset.cases.map((evaluationCase, index) => [evaluationCase.caseId, observations[index]]),
  );

  // Unknown dimensions are surfaced only where they enter the evaluation contract (reference targets);
  // unrelated model-output metadata is neither a violation nor a reason to exclude a case (MDS §3.4).
  const violations: RunTechnicalViolation[] = [];
  const ranking = evaluateRankingCases(request.dataset.cases, observationsByCaseId, violations);
  const fixed = evaluateFixedDimensions(request.dataset.cases, observationsByCaseId, violations);

  const caseResults = request.dataset.cases.map((evaluationCase, index) => Object.freeze({
    caseId: evaluationCase.caseId,
    modelObservation: Object.freeze(observations[index]),
    metricResults: Object.freeze([...(ranking.resultsByCaseId.get(evaluationCase.caseId) ?? [])]),
  }));

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
    evaluationContractHash: computeEvaluationContractHash(),
    configurationHash: request.configurationHash,
    toolchainIdentity: request.toolchainIdentity,
    datasetRole: request.dataset.role,
    heldOutParameterVersionIds: request.dataset.heldOutParameterVersionIds
      ? Object.freeze([...request.dataset.heldOutParameterVersionIds])
      : undefined,
    caseResults: Object.freeze(caseResults),
    runLevelMetricResults: fixed.results,
    metricCoverage: Object.freeze([...fixed.coverage, ...(ranking.coverage.planned > 0 ? [ranking.coverage] : [])]),
    technicalContractViolations: Object.freeze(violations),
    executionTimestamp: metadata.executionTimestamp,
  });
}
