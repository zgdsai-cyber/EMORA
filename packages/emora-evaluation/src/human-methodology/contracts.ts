export const HUMAN_PROTOCOL_STATUSES = [
  'DEFINED',
  'UNRESOLVED',
  'NOT_EVALUABLE',
] as const;
export type HumanProtocolStatus = (typeof HUMAN_PROTOCOL_STATUSES)[number];

export const HUMAN_EVALUATION_OUTPUTS = [
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
  'valence',
  'arousal',
  'intensity',
] as const;
export type HumanEvaluationOutput = (typeof HUMAN_EVALUATION_OUTPUTS)[number];

export const COMPUTATIONAL_ONLY_OUTPUTS = [
  'confidence',
  'confidenceAdjustment',
] as const;
export type ComputationalOnlyOutput =
  (typeof COMPUTATIONAL_ONLY_OUTPUTS)[number];

export const OBSERVATION_FIELD_IDS = [
  'PARTICIPANT_PSEUDONYMOUS_ID',
  'STUDY_ID',
  'SESSION_ID',
  'SEQUENCE_ID',
  'OBSERVATION_ID',
  'TIMESTAMP',
  'EVENT_CONTEXT',
  'HUMAN_MEASUREMENT_DEFINITION',
  'MEASUREMENT_SCALE_UNIT',
  'COLLECTION_METHOD_VERSION',
  'MISSINGNESS_STATE',
  'EMORA_INPUT_REFERENCE',
  'EMORA_OUTPUT_REFERENCE',
  'CONSTRUCT_MAPPING_REFERENCE',
  'PROVENANCE',
] as const;
export type ObservationFieldId = (typeof OBSERVATION_FIELD_IDS)[number];

export const HUMAN_MISSINGNESS_STATES = [
  'OBSERVED',
  'MISSING',
  'NOT_APPLICABLE',
  'INVALID',
  'DECLINED',
  'WITHDRAWN',
] as const;
export type HumanMissingnessState =
  (typeof HUMAN_MISSINGNESS_STATES)[number];

export const CONSTRUCT_MAPPING_TYPES = [
  'DIRECTLY_RECORDED_MEASURE',
  'INDIRECT_INDICATOR',
  'COMPUTATIONAL_ONLY',
  'NOT_SUITABLE_FOR_HUMAN_EVALUATION',
] as const;
export type ConstructMappingType = (typeof CONSTRUCT_MAPPING_TYPES)[number];

export const DESCRIPTIVE_CRITERION_KINDS = [
  'ERROR',
  'DESCRIPTIVE_ASSOCIATION',
  'PREDEFINED_AGREEMENT',
  'PREDEFINED_DIRECTIONAL_CORRESPONDENCE',
  'PREDEFINED_TEMPORAL_CORRESPONDENCE',
  'COVERAGE_MISSINGNESS_REPORTING',
] as const;
export type DescriptiveCriterionKind =
  (typeof DESCRIPTIVE_CRITERION_KINDS)[number];

export const LEAKAGE_CONTROLS = [
  'FREEZE_CRITERIA_BEFORE_RESULTS',
  'SEPARATE_DESIGN_AND_EVALUATION_DATA',
  'PARTICIPANT_LEVEL_HELD_OUT_SEPARATION_WHERE_APPLICABLE',
  'NO_TUNING_ON_EVALUATION_DATA',
  'NO_POST_HOC_FAVORABLE_SELECTION',
  'VERSION_PROTOCOL_CHANGES_WITHOUT_REWRITING_PRIOR_RESULTS',
] as const;
export type LeakageControl = (typeof LEAKAGE_CONTROLS)[number];

export const FALSIFIABILITY_OUTCOMES = [
  'DESCRIPTIVE_SUPPORT',
  'MISMATCH',
  'PARAMETER_REVIEW',
  'ADAPTATION_REVIEW',
  'REJECTION_REVIEW',
] as const;
export type FalsifiabilityOutcome =
  (typeof FALSIFIABILITY_OUTCOMES)[number];

export const REQUIRED_REPRODUCIBILITY_FIELDS = [
  'DATASET_ID_VERSION_HASH',
  'TARGET_POPULATION',
  'INCLUSION_EXCLUSION_CRITERIA',
  'OBSERVATION_SCHEMA',
  'MEASUREMENT_DEFINITIONS',
  'CONSTRUCT_MAPPINGS',
  'DATA_PARTITIONS',
  'EMORA_VERSION_COMMIT',
  'CONFIGURATION_HASH',
  'PARAMETER_VERSION_HASH',
  'PREPROCESSING_PROTOCOL',
  'PROTOCOL_VERSION_HASH',
  'BASELINE_CONFIGURATION',
  'SOFTWARE_TOOL_IDENTITY',
  'DETERMINISTIC_SEEDS_WHERE_APPLICABLE',
  'RESULT_ARTIFACT_REFERENCES',
] as const;
export type ReproducibilityField =
  (typeof REQUIRED_REPRODUCIBILITY_FIELDS)[number];

export const ETHICS_GOVERNANCE_REQUIREMENTS = [
  'INFORMED_PARTICIPATION_CONSENT_WHERE_APPLICABLE',
  'PSEUDONYMIZATION',
  'DATA_MINIMIZATION',
  'ACCESS_CONTROL',
  'SECURE_HANDLING',
  'RETENTION_DELETION_POLICY',
  'WITHDRAWAL_CONSIDERATIONS',
  'NO_CLINICAL_OR_DIAGNOSTIC_USE',
  'NO_LEGAL_OR_REGULATORY_COMPLIANCE_CLAIM',
] as const;
export type EthicsGovernanceRequirement =
  (typeof ETHICS_GOVERNANCE_REQUIREMENTS)[number];

export const SCIENTIFIC_BOUNDARY_STATEMENTS = [
  'EMORA is not currently scientifically validated as a model of human emotion.',
  'Human observations are measurements or indicators, not direct observations of internal emotional states.',
  'Synthetic mathematical performance is not evidence of human psychological validity.',
  'confidence and confidenceAdjustment are computational constructs, not psychological targets.',
  'Unresolved construct mappings cannot be evaluated.',
  'Human behavioral evaluation cannot establish causality.',
  'Human results cannot automatically modify governed mathematical decisions.',
] as const;

export interface GovernedMethodologyState {
  readonly status: HumanProtocolStatus;
  readonly description: string;
  readonly unresolvedReason?: string;
}

export interface EvaluationScopeDefinition {
  readonly targetOutputs: readonly HumanEvaluationOutput[];
  readonly excludedOutputs: readonly HumanEvaluationOutput[];
  readonly computationalOnlyOutputs: readonly ComputationalOnlyOutput[];
  readonly deferredComponents: readonly ['HYBRID_FUSION'];
}

export interface ObservationFieldDefinition extends GovernedMethodologyState {
  readonly fieldId: ObservationFieldId;
  readonly required: boolean;
}

export interface HumanObservationSchemaDefinition
  extends GovernedMethodologyState {
  readonly fields: readonly ObservationFieldDefinition[];
  readonly missingnessStates: readonly HumanMissingnessState[];
  readonly dataCollection: 'NONE_METHODOLOGY_ONLY';
}

export interface PopulationDefinition extends GovernedMethodologyState {
  readonly targetPopulation?: string;
  readonly contextDefinition?: string;
  readonly inclusionCriteria?: readonly string[];
  readonly exclusionCriteria?: readonly string[];
}

export interface DataPartitionDefinition extends GovernedMethodologyState {
  readonly designEvaluationSeparated: true;
  readonly participantLevelHeldOutWhereApplicable: true;
  readonly designPartitionDefinition?: string;
  readonly evaluationPartitionDefinition?: string;
}

export interface HumanConstructMapping extends GovernedMethodologyState {
  readonly mappingId: string;
  readonly emoraOutput: HumanEvaluationOutput;
  readonly humanConstruct?: string;
  readonly measurementDefinition?: string;
  readonly mappingType: ConstructMappingType;
  readonly evidenceProvenanceReference?: string;
}

export interface DescriptiveEvaluationCriterion
  extends GovernedMethodologyState {
  readonly criterionId: string;
  readonly kind: DescriptiveCriterionKind;
  readonly mappingIds: readonly string[];
  readonly predefinedDefinition?: string;
}

export interface GovernedBaselineDefinition
  extends GovernedMethodologyState {
  readonly baselineId: string;
  readonly baselineVersion: string;
  readonly baselineKind:
    | 'CONSTANT'
    | 'DETERMINISTIC_ABLATION'
    | 'PERSISTENCE'
    | 'OTHER_PREDEFINED';
  readonly configurationHash?: string;
  readonly rationale?: string;
}

export interface BaselineProtocolDefinition extends GovernedMethodologyState {
  readonly definitions: readonly GovernedBaselineDefinition[];
  readonly execution: 'NOT_IMPLEMENTED';
  readonly comparisonInterpretation: 'DESCRIPTIVE_SIDE_BY_SIDE_ONLY';
}

export interface TemporalEvaluationDefinition
  extends GovernedMethodologyState {
  readonly repeatedObservationsRepresented: true;
  readonly orderingRequired: true;
  readonly observationIntervalsRequired: true;
  readonly withinPersonBetweenPersonSeparated: true;
  readonly missingObservationsExplicit: true;
  readonly participantAggregationPredefined: true;
  readonly intervalPolicy?: string;
  readonly participantAggregationDefinition?: string;
  readonly statisticalModel: 'NONE';
}

export interface IndividualDifferenceDefinition
  extends GovernedMethodologyState {
  readonly populationLevelSeparated: true;
  readonly individualPatternsSeparated: true;
  readonly stableDifferencesRequireRepeatedContexts: true;
  readonly independentTraitMeasurementRequired: true;
  readonly emoraTraitAccuracyClaim: 'NONE';
}

export interface FalsifiabilityCondition {
  readonly outcome: FalsifiabilityOutcome;
  readonly condition: string;
  readonly governanceBoundary: string;
  readonly automaticDecision: false;
}

export interface ReproducibilityDefinition extends GovernedMethodologyState {
  readonly requiredFields: readonly ReproducibilityField[];
}

export interface EthicsGovernanceDefinition extends GovernedMethodologyState {
  readonly requirements: readonly EthicsGovernanceRequirement[];
}

export interface UnresolvedMethodologicalItem {
  readonly itemId: string;
  readonly domain:
    | 'CONSTRUCT_MAPPING'
    | 'MEASUREMENT'
    | 'CRITERION'
    | 'BASELINE'
    | 'TEMPORAL_DESIGN'
    | 'INDIVIDUAL_DIFFERENCES'
    | 'POPULATION'
    | 'PARTITIONING'
    | 'ETHICS_GOVERNANCE';
  readonly status: 'UNRESOLVED' | 'NOT_EVALUABLE';
  readonly reason: string;
}

export interface HumanBehavioralEvaluationProtocolInput {
  readonly protocolId: string;
  readonly protocolVersion: string;
  readonly methodologyVersion: string;
  readonly status: HumanProtocolStatus;
  readonly issuedDate: string;
  readonly scope: EvaluationScopeDefinition;
  readonly population: PopulationDefinition;
  readonly observationSchema: HumanObservationSchemaDefinition;
  readonly constructMappings: readonly HumanConstructMapping[];
  readonly descriptiveCriteria: readonly DescriptiveEvaluationCriterion[];
  readonly baselines: BaselineProtocolDefinition;
  readonly temporalEvaluation: TemporalEvaluationDefinition;
  readonly individualDifferences: IndividualDifferenceDefinition;
  readonly partitioning: DataPartitionDefinition;
  readonly leakageControls: readonly LeakageControl[];
  readonly falsifiabilityConditions: readonly FalsifiabilityCondition[];
  readonly reproducibility: ReproducibilityDefinition;
  readonly ethicsGovernance: EthicsGovernanceDefinition;
  readonly scientificBoundary: readonly string[];
  readonly unresolvedItems: readonly UnresolvedMethodologicalItem[];
}

export interface HumanBehavioralEvaluationProtocol
  extends HumanBehavioralEvaluationProtocolInput {
  readonly scopeKind: 'HUMAN_METHODOLOGY_ONLY';
  readonly execution: 'NOT_IMPLEMENTED';
  readonly humanData: 'NONE';
  readonly protocolHash: string;
}
