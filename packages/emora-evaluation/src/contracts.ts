import type {
  EmotionalEvent,
  EmotionalMemory,
  EmotionInfluence,
  DeterministicModelParameters,
  StateTransitionInput,
  StateTransitionProvider,
} from '@emora/emotional-core';

export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';
export type GateStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface EvaluationIdentity {
  readonly caseId: string;
  readonly parameterVersionId: string;
  readonly parameterSetHash: string;
  readonly providerIdentifier: string;
  readonly providerVersion?: string;
  readonly runtimeContract: string;
}

export interface GateResult {
  readonly gateId: GateId;
  readonly status: GateStatus;
  readonly caseId: string;
  readonly property: string;
  readonly observedValue: unknown;
  readonly expected: string;
  readonly tolerance: string;
  readonly inputReference: string;
  readonly parameterVersionId: string;
  readonly parameterSetHash: string;
  readonly providerIdentifier: string;
  readonly providerVersion?: string;
  readonly runtimeContract: string;
  readonly failureReason?: string;
}

export interface L1EvaluationReport {
  readonly status: GateStatus;
  readonly identity: EvaluationIdentity;
  readonly outputCanonical: string;
  readonly reportHash: string;
  readonly results: readonly GateResult[];
}

export interface L1EvaluationCase {
  readonly identity: EvaluationIdentity;
  readonly input: StateTransitionInput;
}

export interface EventImpactMonotonicityProbe {
  readonly identity: EvaluationIdentity;
  readonly baseEvent: EmotionalEvent;
  readonly increasedSurpriseEvent: EmotionalEvent;
  readonly modelParameters?: DeterministicModelParameters;
}

export interface MemoryDecayProbe {
  readonly identity: EvaluationIdentity;
  readonly memory: EmotionalMemory;
  readonly initialReferenceTimestamp: string;
  readonly laterReferenceTimestamp: string;
  readonly futureReferenceTimestamp: string;
}

export interface TemporalStabilityProbe {
  readonly identity: EvaluationIdentity;
  readonly currentVector: StateTransitionInput['currentState']['emotionVector'];
  readonly delta: EmotionInfluence;
  readonly modelParameters: DeterministicModelParameters;
}

export interface EvaluationEngine {
  readonly provider: StateTransitionProvider;
  readonly runtimeContract: string;
  readonly engineVersion: string;
  readonly engineCommit: string;
}

export interface L1EvaluationOptions {
  readonly engine: EvaluationEngine;
  readonly evaluationCase: L1EvaluationCase;
}

// ============================================================================
// L2-A PURE CONTRACT PRIMITIVES
// ============================================================================

export type ReferenceType =
  | 'HUMAN_ANNOTATED'
  | 'EXPERT_DESIGN'
  | 'BASELINE_AGREEMENT'
  | 'SYNTHETIC_ORACLE';

export type AnnotationType =
  | 'EXACT_VECTOR'
  | 'INTERVAL'
  | 'DISTRIBUTION'
  /**
   * Ranking of EMORA emotion dimensions within a single EvaluationCase/scenario; not a cross-case ranking.
   * targetValues are competition ranks (RANK_1_IS_HIGHEST, ties allowed, e.g. {joy:1, fear:1, anger:3}); see SPEARMAN_RANKING_PROTOCOL.
   */
  | 'RANKING'
  | 'DIRECTIONAL_DELTA';

export type EmotionTargetType =
  | 'EMOTE_VECTOR_DIMENSION'
  | 'VALENCE'
  | 'AROUSAL'
  | 'INTENSITY'
  | 'RANK_ORDER'
  | 'DIRECTIONAL_SIGN';

export type DataObservationStatus =
  | 'OBSERVED'
  | 'MISSING'
  | 'NOT_APPLICABLE'
  | 'INVALID';

export interface ReferenceAnnotation {
  readonly annotationType: AnnotationType;
  readonly targetValues: Readonly<Record<string, unknown>>;
  readonly annotatorCount?: number;
  readonly interRaterAgreement?: number;
  readonly missingnessRatio?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface EvaluationCase {
  readonly caseId: string;
  readonly datasetId: string;
  readonly input: unknown;
  readonly referenceAnnotation: ReferenceAnnotation;
}

/**
 * MDS v1.0 §12. Provenance only; a role never establishes scientific validity.
 * DESIGN: consulted while designing/tuning parameters or rules.
 * HELD_OUT: not consulted during design; `heldOutParameterVersionIds` records
 * which parameter versions it was held out from, where applicable.
 */
export type DatasetRole = 'DESIGN' | 'HELD_OUT';

export interface EvaluationDataset {
  readonly datasetId: string;
  readonly datasetVersion: string;
  /** Must equal computeDatasetHash(this); see MDS v1.0 §13. */
  readonly datasetHash: string;
  readonly referenceType: ReferenceType;
  readonly role: DatasetRole;
  readonly heldOutParameterVersionIds?: readonly string[];
  readonly title: string;
  readonly description: string;
  readonly casesCount: number;
  readonly cases: readonly EvaluationCase[];
  readonly provenanceMetadata: Readonly<Record<string, unknown>>;
}

export type ModelObservationStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'INVALID_OUTPUT'
  | 'NOT_EXECUTED';

export interface ModelObservation {
  readonly caseId: string;
  readonly status: ModelObservationStatus;
  /** Present only for SUCCESS; failed statuses must not fabricate values. */
  readonly observedValues?: Readonly<Record<string, unknown>>;
  readonly executionTimestamp?: string;
  readonly failureReason?: string;
}

export interface MetricDefinition {
  readonly metricId: string;
  readonly name: string;
  readonly formulaDescription: string;
  readonly targetType: EmotionTargetType;
  readonly annotationType: AnnotationType;
  /** Statistic class of the metric output; the evaluated dimension's range is defined by the dimension registry (MDS v1.0 §7). */
  readonly scale: 'ERROR_NON_NEGATIVE' | 'BOUNDED_0_1' | 'BOUNDED_MINUS1_1' | 'ORDINAL' | 'UNBOUNDED';
  readonly assumptions: readonly string[];
}

export interface MetricResult {
  readonly metricId: string;
  /** A single semantic dimension identifier (e.g. 'joy'); composite/joined labels (e.g. 'joy,fear') are prohibited. */
  readonly dimension: string;
  readonly value: number;
  readonly sampleSize: number;
  /**
   * Legacy compatibility field. Pure metric functions receive pre-filtered numeric
   * series and have no case-level context, so this is always 0 and is NOT a
   * coverage or missingness measure. MetricCoverage (runner) is authoritative.
   */
  readonly missingCasesCount: number;
  readonly status: 'COMPUTED' | 'INVALID' | 'INSUFFICIENT_DATA';
  readonly failureReason?: string;
}

// ============================================================================
// MDS v1.0 §8 / §21 — COVERAGE AND TECHNICAL VIOLATIONS (evaluation layer only)
// ============================================================================

/** Why a planned unit did not contribute. Composed from existing execution/reference vocabularies plus MDS §21 violations. */
export type CoverageExclusionReason =
  | 'EXECUTION_FAILED'
  | 'EXECUTION_INVALID_OUTPUT'
  | 'EXECUTION_NOT_EXECUTED'
  | 'REFERENCE_MISSING'
  | 'REFERENCE_INVALID'
  | 'MODEL_DIMENSION_ABSENT'
  | 'COMPUTATIONAL_DIMENSION_EXCLUDED'
  | 'UNKNOWN_DIMENSION'
  | 'MIXED_SEMANTIC_SPACE'
  | 'INSUFFICIENT_DATA'
  | 'METRIC_INVALID';

export interface CoverageExclusion {
  readonly caseId: string;
  readonly reason: CoverageExclusionReason;
  readonly detail?: string;
}

export type MetricObservationalUnit = 'CASE_DIMENSION' | 'CASE_RANKING_SPACE';

/**
 * Per-metric coverage over its declared observational unit. `planned` counts
 * units the reference declared; `eligible` those meeting the metric's
 * applicability, reference, execution, and behavioral-target requirements;
 * `contributing` those that entered a COMPUTED result. planned = contributing + excluded.
 */
export interface MetricCoverage {
  readonly metricId: string;
  readonly unit: MetricObservationalUnit;
  /** Dimension id for CASE_DIMENSION; ranking-space id for CASE_RANKING_SPACE. */
  readonly dimension: string;
  readonly planned: number;
  readonly eligible: number;
  readonly contributing: number;
  readonly excluded: number;
  readonly exclusions: readonly CoverageExclusion[];
}

export interface RunTechnicalViolation {
  readonly violation: 'UNKNOWN_DIMENSION' | 'MIXED_SEMANTIC_SPACE';
  readonly caseId: string;
  /** Violations arise only from dimensions that enter the evaluation contract via the reference. */
  readonly source: 'REFERENCE';
  readonly dimension?: string;
  readonly metricId?: string;
}

// ============================================================================
// L2-B EXECUTION CONTRACT PRIMITIVES
// ============================================================================

export interface EvaluationRequest {
  readonly dataset: EvaluationDataset;
  readonly engine: EvaluationEngine;
  readonly parameterVersionId?: string;
  readonly parameterVersionHash?: string;
  readonly evaluationContractVersion: string;
  readonly configurationHash?: string;
}

export interface EvaluationCaseResult {
  readonly caseId: string;
  readonly modelObservation: ModelObservation;
  readonly metricResults: readonly MetricResult[];
}

export interface EvaluationRun {
  readonly runId: string;
  readonly datasetIdentity: Readonly<{
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly datasetHash: string;
  }>;
  readonly engineIdentity: Readonly<{
    readonly engineVersion: string;
    readonly engineCommit: string;
    readonly runtimeContract: string;
  }>;
  readonly parameterVersionId?: string;
  readonly parameterVersionHash?: string;
  readonly evaluationContractVersion: string;
  readonly configurationHash?: string;
  readonly datasetRole: DatasetRole;
  readonly heldOutParameterVersionIds?: readonly string[];
  readonly caseResults: readonly EvaluationCaseResult[];
  /**
   * Metrics whose sampling unit is one fixed target dimension aggregated across
   * multiple EvaluationCases in this run (e.g. MAE/RMSE per dimension), as distinct
   * from case-level metrics already present in caseResults[].metricResults (e.g. Spearman).
   * Optional and additive; absent until a future runner populates it.
   */
  readonly runLevelMetricResults?: readonly MetricResult[];
  /** One entry per (metricId, unit dimension); every planned unit's fate is recorded here (MDS v1.0 §8). */
  readonly metricCoverage: readonly MetricCoverage[];
  /** Fatal for the affected evidence only; never a warning and never a scientific verdict (MDS v1.0 §21). */
  readonly technicalContractViolations: readonly RunTechnicalViolation[];
  readonly executionTimestamp: string;
}

// ============================================================================
// PHASE 6.5-A — EVALUATION REPORT / EVIDENCE BUNDLE PURE CONTRACTS
// Contract-only: no execution, no metric computation, no aggregation logic.
// A future pure aggregator (not implemented here) will populate these shapes
// from an existing EvaluationRun without recomputing or duplicating its data.
// ============================================================================

/**
 * Technical execution status of a run ONLY. Never implies model quality,
 * validation, or scientific outcome. COMPLETE means every planned
 * EvaluationCase produced a final ModelObservation (SUCCESS, FAILED, or
 * INVALID_OUTPUT all count as "produced"); it does NOT mean every case
 * succeeded. PARTIAL means execution stopped before all planned cases were
 * processed. FAILED means the run itself could not produce a usable
 * EvaluationRun due to a failure in the run's own execution (not a single
 * case failure).
 */
export type RunExecutionStatus = 'COMPLETE' | 'PARTIAL' | 'FAILED';

/** Case-level ModelObservation status tally; distinct from reference-side missingness. */
export interface EvaluationExecutionSummary {
  readonly totalCases: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly invalidOutputCount: number;
  readonly notExecutedCount: number;
}

/** Reference/annotation-side data-quality tally (DataObservationStatus); never merges with execution failures. */
export interface EvaluationMissingnessSummary {
  readonly observedCount: number;
  readonly missingCount: number;
  readonly notApplicableCount: number;
  readonly invalidCount: number;
}

/**
 * Whether/why a metric produced a result for this run. DEFERRED and
 * UNDEFINED are methodological states (see MetricDefinition.assumptions),
 * never a model failure. NOT_APPLICABLE means the metric's annotationType
 * did not match any case in the dataset.
 */
export type MetricComputationStatus =
  | 'COMPUTED'
  | 'NOT_COMPUTED'
  | 'INSUFFICIENT_DATA'
  | 'METHODOLOGY_DEFERRED'
  | 'METHODOLOGY_UNDEFINED'
  | 'NOT_APPLICABLE';

/**
 * References an existing MetricDefinition by metricId; does not duplicate its
 * formula or assumptions. metricDefinitionVersion is intentionally omitted:
 * DEFERRED — a single MetricDefinition set currently exists per
 * evaluationContractVersion, so no additional versioning field is required yet.
 */
export interface MetricStatusSummary {
  readonly metricId: string;
  readonly computationStatus: MetricComputationStatus;
  readonly methodologicalNote?: string;
}

/**
 * Scientific evidence provenance, distinct from the technical reproducibility
 * fields already present on EvaluationRun (datasetIdentity, engineIdentity,
 * parameterVersionId/Hash, evaluationContractVersion, configurationHash,
 * executionTimestamp) — those are NOT duplicated here.
 * referenceType also distinguishes SYNTHETIC EVALUATION (SYNTHETIC_ORACLE,
 * EXPERT_DESIGN, BASELINE_AGREEMENT) from HUMAN BEHAVIORAL EVALUATION
 * (HUMAN_ANNOTATED); none of these values constitutes universal or
 * psychological ground truth.
 */
/** Supplied per-case scalar preserved verbatim; heterogeneity is never collapsed (MDS v1.0 §10.2). */
export interface CaseScalarProvenance {
  readonly caseId: string;
  readonly value: number;
}

export interface ScientificEvidenceProvenance {
  readonly referenceType: ReferenceType;
  readonly datasetRole: DatasetRole;
  readonly heldOutParameterVersionIds?: readonly string[];
  /** DEFERRED until human annotation-collection protocols are approved. */
  readonly annotationProvenance?: 'DEFERRED';
  readonly annotatorCountsByCase: readonly CaseScalarProvenance[];
  readonly interRaterAgreementsByCase: readonly CaseScalarProvenance[];
  readonly datasetProvenanceMetadata?: Readonly<Record<string, unknown>>;
}

/** Purely descriptive pointer to an existing case/metric; introduces no new statistical method. */
export type CounterexampleLevel = 'CASE_LEVEL' | 'METRIC_LEVEL';

export interface EvaluationCounterexampleReference {
  readonly level: CounterexampleLevel;
  readonly metricId?: string;
  readonly dimension?: string;
  readonly caseId?: string;
  readonly description: string;
}

/**
 * Scoped, non-universal support labels. NEVER auto-computed by this contract
 * or by Phase 6.5-A; assigning a value requires an explicit future
 * methodological decision. Never combine into a single composite/overall score.
 */
export type ScientificSupportLabel =
  | 'MATHEMATICALLY_SUPPORTED'
  | 'STRUCTURALLY_SUPPORTED'
  | 'BEHAVIORALLY_SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'INCONCLUSIVE'
  | 'UNSUPPORTED'
  | 'DEFERRED';

export interface EvaluationDatasetIdentity {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
}

/** Explicit reference-side quality; no status is inferred from targetValues. */
export interface ReferenceObservationStatus {
  readonly caseId: string;
  readonly targetId: string;
  readonly status: DataObservationStatus;
}

/** Statuses apply only when this identity exactly matches the report dataset. */
export interface ReferenceObservationStatusContext {
  readonly datasetIdentity: EvaluationDatasetIdentity;
  readonly observations: readonly ReferenceObservationStatus[];
}

export type TechnicalContractViolation =
  | 'DUPLICATE_PLANNED_CASE_ID'
  | 'DUPLICATE_RESULT_CASE_ID'
  | 'UNEXPECTED_RESULT_CASE_ID'
  | 'DATASET_IDENTITY_MISMATCH'
  | 'DATASET_HASH_MISMATCH'
  | 'REFERENCE_STATUS_DATASET_IDENTITY_MISMATCH'
  | 'UNKNOWN_DIMENSION'
  | 'MIXED_SEMANTIC_SPACE';

/** Facts not derivable from EvaluationRun; EvaluationDataset remains authoritative. */
export interface EvaluationReportContext {
  readonly reportId: string;
  readonly dataset: EvaluationDataset;
  readonly metricDefinitions: readonly MetricDefinition[];
  readonly referenceObservationStatuses: ReferenceObservationStatusContext;
  readonly deferredMethodologicalNotes?: readonly string[];
  readonly counterexampleReferences?: readonly EvaluationCounterexampleReference[];
}

/** A usable run or a run-level technical failure, without a duplicate status field. */
export type EvaluationReportInput =
  | Readonly<{ readonly kind: 'RUN_AVAILABLE'; readonly run: EvaluationRun }>
  | Readonly<{
      readonly kind: 'RUN_FAILED';
      readonly failureReason: string;
      readonly attemptedDatasetIdentity: EvaluationDatasetIdentity;
      readonly technicalFailure?: TechnicalContractViolation;
    }>;

/**
 * Pure evidence bundle derived from an existing EvaluationRun. References
 * "run" directly instead of duplicating its case-level/run-level results or
 * technical provenance fields. Case-level results (e.g. Spearman) remain in
 * run.caseResults[].metricResults; run-level results (e.g. MAE/RMSE) remain
 * in run.runLevelMetricResults. This contract does not merge them.
 * No field on this interface may represent a composite/overall scientific
 * score, a PASS/FAIL scientific verdict, or a claim of psychological or
 * universal validity.
 *
 * EvaluationReport IS the Phase 6.5-A evidence bundle contract: it is the
 * single, sufficient representation of run identity, execution results,
 * metric results, technical provenance, scientific provenance,
 * counterexample references, and deferred/methodological information for a
 * given EvaluationRun. No separate "EvidenceBundle" type is introduced,
 * because it would either duplicate this interface's fields or merely rename
 * it; EvaluationReport already composes/references the existing EvaluationRun,
 * EvaluationCaseResult, and MetricResult contracts rather than copying them.
 */
interface EvaluationReportBase {
  readonly reportId: string;
  readonly scientificProvenance: ScientificEvidenceProvenance;
  readonly deferredMethodologicalNotes: readonly string[];
  readonly counterexampleReferences?: readonly EvaluationCounterexampleReference[];
  /** Optional and never defaulted; see ScientificSupportLabel. */
  readonly scientificSupportLabels?: readonly ScientificSupportLabel[];
}

export interface CompleteEvaluationReport extends EvaluationReportBase {
  readonly executionStatus: 'COMPLETE';
  readonly run: EvaluationRun;
  readonly executionSummary: EvaluationExecutionSummary;
  readonly missingnessSummary: EvaluationMissingnessSummary;
  readonly metricStatusSummaries: readonly MetricStatusSummary[];
}

export interface PartialEvaluationReport extends EvaluationReportBase {
  readonly executionStatus: 'PARTIAL';
  readonly run: EvaluationRun;
  readonly executionSummary: EvaluationExecutionSummary;
  readonly missingnessSummary: EvaluationMissingnessSummary;
  readonly metricStatusSummaries: readonly MetricStatusSummary[];
}

export interface FailedEvaluationReport extends EvaluationReportBase {
  readonly executionStatus: 'FAILED';
  readonly failureReason: string;
  readonly attemptedDatasetIdentity: EvaluationDatasetIdentity;
  readonly technicalFailure?: TechnicalContractViolation;
}

/** Discriminated technical execution outcome; never a scientific verdict. */
export type EvaluationReport =
  | CompleteEvaluationReport
  | PartialEvaluationReport
  | FailedEvaluationReport;
