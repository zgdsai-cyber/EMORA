import type {
  HumanEvaluationOutput,
  HumanMissingnessState,
} from '../human-methodology/contracts';

export const D09_CONTRACT_VERSION = 'phase-6.16-d09-v1.0.0' as const;
export const D09_AUTHORITATIVE_CONTRACT_ID =
  'emora-phase-6.16-d09-descriptive-evaluation-criteria' as const;

export const D09_ACTIVE_METRICS = Object.freeze([
  'PEARSON_R',
  'DESCRIPTIVE_DISTRIBUTIONS',
  'COVERAGE_MISSINGNESS',
] as const);
export type D09ActiveMetric = (typeof D09_ACTIVE_METRICS)[number];

export const D09_INACTIVE_METRICS = Object.freeze([
  'SPEARMAN_RHO',
  'MAE',
  'RMSE',
  'DIRECTIONAL_ACCURACY',
  'AGREEMENT_COEFFICIENTS',
  'STANDARDIZED_EFFECT_SIZES',
  'COMPOSITE_SCORES',
  'GLOBAL_SCORES',
  'RANKING_SYSTEMS',
  'WINNER_SELECTION',
  'SIGNIFICANCE_TESTS',
  'P_VALUES',
  'CONFIDENCE_INTERVALS',
  'HYPOTHESIS_TESTS',
  'MULTIPLICITY_CORRECTION',
  'PREDICTIVE_METRICS',
  'CALIBRATION_METRICS',
] as const);
export type D09InactiveMetric = (typeof D09_INACTIVE_METRICS)[number];

export const D09_SCIENTIFIC_BOUNDARIES = Object.freeze([
  'Human observations are observable indicators or measurement variables, not direct access to internal emotional states.',
  'Pearson is descriptive linear association only and is not agreement.',
  'Numeric range compatibility does not establish construct equivalence.',
  'D09 results cannot establish psychological or scientific validity.',
  'D09 results cannot establish causality or predictive validity.',
  'Synthetic mathematical evaluation remains separate from human behavioral evaluation and is not evidence of human psychological validity.',
  'D09 results cannot automatically modify EMORA equations, parameters, or governed model decisions.',
  'D09 produces no scientific ranking, winner, composite score, or global verdict.',
] as const);

export const D09_TEMPORAL_RELATIONSHIPS = Object.freeze([
  'CONTEMPORANEOUS',
  'IMMEDIATE_POST_EVENT',
  'RETROSPECTIVE',
  'ORDERED_OBSERVATION',
] as const);
export type D09TemporalRelationship =
  (typeof D09_TEMPORAL_RELATIONSHIPS)[number];

export const D09_OBSERVATION_STRUCTURES = Object.freeze([
  'SINGLE_OBSERVATION',
  'WITHIN_PERSON_OBSERVATION',
  'BETWEEN_PERSON_OBSERVATION',
] as const);
export type D09ObservationStructure =
  (typeof D09_OBSERVATION_STRUCTURES)[number];

export const D09_SCALE_TYPES = Object.freeze([
  'INTERVAL',
  'RATIO',
  'ORDINAL_WITH_PREDEFINED_INTERVAL_INTERPRETATION',
] as const);
export type D09ScaleType = (typeof D09_SCALE_TYPES)[number];

export const D09_SCALE_DIRECTIONS = Object.freeze([
  'HIGHER_MEANS_MORE',
  'HIGHER_MEANS_LESS',
] as const);
export type D09ScaleDirection = (typeof D09_SCALE_DIRECTIONS)[number];

export const D09_EMORA_OUTPUT_STATUSES = Object.freeze([
  'OBSERVED',
  'MISSING',
  'INVALID',
] as const);
export type D09EmoraOutputStatus =
  (typeof D09_EMORA_OUTPUT_STATUSES)[number];

export type D09Dimension = HumanEvaluationOutput;

export const D09_PROPOSABLE_DIMENSIONS = Object.freeze([
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
  'valence',
  'arousal',
] as const satisfies readonly D09Dimension[]);

export const D09_EXECUTABLE_DIMENSIONS = Object.freeze([] as const);

export interface D09Phase615Reference {
  readonly protocolVersion: '1.0.0';
  readonly methodologyVersion: 'phase-6.15-v1';
  readonly protocolHash: string;
  readonly status: 'UNRESOLVED';
}

export interface D09InstrumentReference {
  readonly methodId: string;
  readonly methodVersion: string;
  readonly language: string;
  readonly measurementUnit: string;
  readonly scaleType: D09ScaleType;
  readonly scaleDirection: D09ScaleDirection;
  readonly pearsonEligibility: 'PREDEFINED_AND_JUSTIFIED';
  readonly scaleInterpretationJustification: string;
}

export interface D09IdentityTransformation {
  readonly kind: 'IDENTITY';
  readonly rationale: string;
  readonly resultIndependent: true;
  readonly frozenBeforeResults: true;
}

export interface D09DimensionCriterion {
  readonly criterionId: string;
  readonly dimension: D09Dimension;
  readonly humanConstruct: string;
  readonly constructMappingReference: string;
  readonly instrument: D09InstrumentReference;
  readonly transformation: D09IdentityTransformation;
  readonly temporalRelationship: D09TemporalRelationship;
  readonly observationStructure: D09ObservationStructure;
  readonly pairEligibilityRule: 'EXPLICIT_STATUS_PAIRING_ONLY';
  readonly exclusions: 'NONE_CONFIGURED';
  readonly partialResponseRule: 'NOT_CONFIGURED';
  readonly limitations: readonly string[];
}

export interface D09DescriptiveEvaluationContractInput {
  readonly contractId: string;
  readonly contractVersion: typeof D09_CONTRACT_VERSION;
  readonly objective:
    'Evaluate descriptive correspondence/association between EMORA computational outputs and predefined human-observable indicators.';
  readonly phase615ProtocolReference: D09Phase615Reference;
  readonly activeMetrics: readonly D09ActiveMetric[];
  readonly inactiveMetrics: readonly D09InactiveMetric[];
  readonly criteria: readonly D09DimensionCriterion[];
  readonly missingnessStates: readonly HumanMissingnessState[];
  readonly participantAggregation: 'DEFERRED';
  readonly repeatedMeasuresMethodology: 'DEFERRED';
  readonly temporalDynamicsMethodology: 'DEFERRED';
  readonly thresholds: 'NOT_IMPLEMENTED';
  readonly baselines: 'NOT_IMPLEMENTED';
  readonly dataCollection: 'NOT_AUTHORIZED';
  readonly currentHumanDataset: 'NONE' | 'GOVERNED_DATASET_REQUIRED';
  readonly metricFormulaIdentity:
    'PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT';
  readonly denominatorDefinition:
    'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED';
  readonly observationScopeRule:
    'SINGLE_PARTICIPANT_STUDY_SESSION_SEQUENCE_CONTEXT_ONLY';
  readonly scientificBoundaries: readonly string[];
}

export interface D09DescriptiveEvaluationContract
  extends D09DescriptiveEvaluationContractInput {
  readonly scopeKind: 'D09_DESCRIPTIVE_CRITERIA';
  readonly executionState:
    | 'NOT_EXECUTABLE_NO_HUMAN_DATA'
    | 'NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED';
  readonly contractHash: string;
}

export interface D09HumanMeasurement {
  readonly status: HumanMissingnessState;
  readonly value?: number;
}

export interface D09EmoraOutputMeasurement {
  readonly status: D09EmoraOutputStatus;
  readonly value?: number;
}

export interface D09Observation {
  readonly participantPseudonymousId: string;
  readonly studyId: string;
  readonly sessionId: string;
  readonly observationId: string;
  readonly sequenceId?: string;
  readonly eventContext: string;
  readonly timestamp: string;
  readonly temporalRelationship: D09TemporalRelationship;
  readonly observationStructure: D09ObservationStructure;
  readonly dimension: D09Dimension;
  readonly constructMappingReference: string;
  readonly humanMeasurement: D09HumanMeasurement;
  readonly emoraOutput: D09EmoraOutputMeasurement;
  readonly deviation?: string;
}

export interface D09GovernedHumanDatasetInput {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly protocolId: string;
  readonly protocolVersion: string;
  readonly protocolHash: string;
  readonly emoraVersion: string;
  readonly emoraCommit: string;
  readonly configurationIdentity:
    | Readonly<{ readonly status: 'PROVIDED'; readonly hash: string }>
    | Readonly<{ readonly status: 'NOT_PROVIDED' }>;
  readonly observations: readonly D09Observation[];
  readonly dataKind: 'GOVERNED_HUMAN_OBSERVATIONS';
}

export interface D09GovernedHumanDataset
  extends D09GovernedHumanDatasetInput {
  readonly datasetHash: string;
}

export interface D09UnitTestFixtureInput
  extends Omit<D09GovernedHumanDatasetInput, 'dataKind'> {
  readonly dataKind: 'D09_UNIT_TEST_FIXTURE';
}

export interface D09UnitTestFixture extends D09UnitTestFixtureInput {
  readonly fixtureHash: string;
}

export interface D09ReportingBoundary {
  readonly metric: 'PEARSON_R';
  readonly formulaIdentity:
    'PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT';
  readonly interpretation: 'DESCRIPTIVE_LINEAR_ASSOCIATION_ONLY';
  readonly exclusionsState: 'NONE_CONFIGURED';
  readonly partialResponseState: 'NOT_CONFIGURED';
  readonly denominatorDefinition:
    'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED';
  readonly missingnessStates: readonly HumanMissingnessState[];
  readonly participantAggregation: 'DEFERRED';
  readonly repeatedMeasuresMethodology: 'DEFERRED';
  readonly temporalDynamicsMethodology: 'DEFERRED';
  readonly provenanceState: 'NOT_APPLICABLE_NO_EXECUTION';
}

export interface D09NonExecutableReport {
  readonly status:
    | 'NOT_EXECUTABLE_NO_HUMAN_DATA'
    | 'NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED'
    | 'NOT_EXECUTABLE_TEST_FIXTURE';
  readonly contractId: string;
  readonly contractVersion: typeof D09_CONTRACT_VERSION;
  readonly contractHash: string;
  readonly activeMetrics: readonly D09ActiveMetric[];
  readonly scientificBoundaries: readonly string[];
  readonly reportingBoundary: D09ReportingBoundary;
  readonly reason:
    | 'No governed human dataset was supplied; no human result was generated.'
    | 'Phase 6.15 remains UNRESOLVED with execution NOT_IMPLEMENTED and humanData NONE; D09 produced no human result.'
    | 'D09 unit-test fixtures are non-human and cannot produce human evaluation results.';
  readonly reportHash: string;
}

export type D09DatasetArtifact =
  | D09GovernedHumanDataset
  | D09UnitTestFixture;

export type D09EvaluationReport = D09NonExecutableReport;
