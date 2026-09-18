/**
 * Phase 6.13 candidate mathematical comparison contracts.
 *
 * These types describe a read-only analytical artifact that records candidate
 * formulations per EMORA mathematical component. They carry no score, rank,
 * winner, superiority, or automatic decision. Component decisions remain
 * governance decisions recorded in docs/mathematical-decision-register.md.
 */

export const MATHEMATICAL_COMPONENTS = [
  'EVENT_IMPACT',
  'PERSONALITY_MODIFIER',
  'VALENCE',
  'AROUSAL',
  'INTENSITY',
  'MEMORY',
  'TEMPORAL_DYNAMICS',
  'INTERACTION_MATRIX',
  'HYBRID_FUSION',
] as const;
export type MathematicalComponent = (typeof MATHEMATICAL_COMPONENTS)[number];

export const GOVERNANCE_DECISIONS = [
  'ADOPT',
  'ADAPT',
  'RETAIN',
  'REJECT',
  'DEFER',
] as const;
export type GovernanceDecision = (typeof GOVERNANCE_DECISIONS)[number];

/** Only register versions this module can check against; unknown versions fail closed. */
export const KNOWN_REGISTER_VERSIONS = ['1.0.0'] as const;
export type KnownRegisterVersion = (typeof KNOWN_REGISTER_VERSIONS)[number];

/**
 * Machine-readable mirror of the frozen Phase 6.12 register state (v1.0.0).
 * docs/mathematical-decision-register.md remains the source of truth; a test
 * parses that document and fails if this mirror diverges. Never derived from candidates.
 */
export const MATHEMATICAL_DECISION_REGISTER_1_0_0: Readonly<
  Record<
    MathematicalComponent,
    Readonly<{ decisionId: string; currentDecision: GovernanceDecision }>
  >
> = Object.freeze({
  EVENT_IMPACT: Object.freeze({
    decisionId: 'MDR-001',
    currentDecision: 'RETAIN',
  }),
  PERSONALITY_MODIFIER: Object.freeze({
    decisionId: 'MDR-002',
    currentDecision: 'RETAIN',
  }),
  VALENCE: Object.freeze({ decisionId: 'MDR-003', currentDecision: 'RETAIN' }),
  AROUSAL: Object.freeze({ decisionId: 'MDR-004', currentDecision: 'RETAIN' }),
  INTENSITY: Object.freeze({
    decisionId: 'MDR-005',
    currentDecision: 'RETAIN',
  }),
  MEMORY: Object.freeze({ decisionId: 'MDR-006', currentDecision: 'RETAIN' }),
  TEMPORAL_DYNAMICS: Object.freeze({
    decisionId: 'MDR-007',
    currentDecision: 'RETAIN',
  }),
  INTERACTION_MATRIX: Object.freeze({
    decisionId: 'MDR-008',
    currentDecision: 'RETAIN',
  }),
  HYBRID_FUSION: Object.freeze({
    decisionId: 'MDR-009',
    currentDecision: 'DEFER',
  }),
});

export const CANDIDATE_FAMILIES_BY_COMPONENT = Object.freeze({
  EVENT_IMPACT: [
    'APPRAISAL_BASED_INTENSITY',
    'RELEVANCE_GOAL_RELEVANCE',
    'SURPRISE_APPRAISAL_NOVELTY',
    'MULTIPLICATIVE',
    'ADDITIVE',
    'NONLINEAR',
    'INTERACTION',
  ],
  PERSONALITY_MODIFIER: [
    'INDIVIDUAL_DIFFERENCE',
    'TRAIT_SITUATION_INTERACTION',
    'SENSITIVITY_REACTIVITY',
    'PERSON_SPECIFIC',
    'NONLINEAR_MODERATION',
  ],
  VALENCE: [
    'DIMENSIONAL_AFFECT',
    'CIRCUMPLEX',
    'COMPONENT_AGGREGATION',
    'ALTERNATIVE_VALENCE_CONSTRUCTION',
  ],
  AROUSAL: [
    'DIMENSIONAL_AFFECT',
    'EMOTION_TO_AROUSAL_MAPPING',
    'DYNAMIC_AROUSAL',
  ],
  INTENSITY: [
    'APPRAISAL_BASED_INTENSITY',
    'EMOTIONAL_INTENSITY',
    'DYNAMIC_INTENSITY',
  ],
  MEMORY: [
    'EXPONENTIAL_DECAY',
    'POWER_LAW_FORGETTING',
    'HYPERBOLIC_DECAY',
    'EMOTIONAL_MEMORY_PERSISTENCE',
    'SALIENCE_WEIGHTED_PERSISTENCE',
  ],
  TEMPORAL_DYNAMICS: [
    'EMOTIONAL_INERTIA',
    'AUTOREGRESSIVE',
    'DYNAMIC_AFFECT',
    'STATE_SPACE',
    'ODE',
    'SDE',
    'PERSON_SPECIFIC_DYNAMICS',
    'NETWORK_DYNAMICS',
  ],
  INTERACTION_MATRIX: [
    'EMOTION_NETWORK',
    'DYNAMIC_EMOTION_NETWORK',
    'COMPONENT_INTERACTION',
    'COUPLING_DEPENDENCY_STRUCTURE',
  ],
  HYBRID_FUSION: [
    'CONVEX_FUSION',
    'MODEL_AVERAGING',
    'MIXTURE_MODEL',
    'ENSEMBLE',
  ],
} as const) satisfies Readonly<
  Record<MathematicalComponent, readonly string[]>
>;

export type CandidateFamily<
  C extends MathematicalComponent = MathematicalComponent,
> = (typeof CANDIDATE_FAMILIES_BY_COMPONENT)[C][number];

export const SOURCE_STATUSES = [
  'VERIFIED',
  'UNVERIFIED',
  'NOT_LOCATED',
  'NOT_APPLICABLE',
  'NOT_REPORTED',
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** Protocol item 12: descriptive versus causal interpretation as reported by the source. */
export const SOURCE_INTERPRETATIONS = [
  'DESCRIPTIVE',
  'CAUSAL',
  'NOT_REPORTED',
] as const;
export type SourceInterpretation = (typeof SOURCE_INTERPRETATIONS)[number];

/**
 * VERIFIED is a caller declaration that the original source was inspected. The
 * validator checks metadata completeness only; it never verifies a source itself.
 */
export const VERIFICATION_BASES = [
  'CALLER_DECLARED_ORIGINAL_SOURCE_INSPECTION',
] as const;
export type VerificationBasis = (typeof VERIFICATION_BASES)[number];

export interface SourceProvenance {
  readonly sourceStatus: SourceStatus;
  readonly interpretation: SourceInterpretation;
  /** Required when VERIFIED; forbidden otherwise. */
  readonly verificationBasis?: VerificationBasis;
  /** Who declared the inspection. Required when VERIFIED. */
  readonly verifiedBy?: string;
  readonly sourceTitle?: string;
  readonly authors?: readonly string[];
  readonly year?: number;
  readonly publication?: string;
  readonly identifier?: string;
  readonly equationReference?: string;
  readonly page?: string;
  readonly section?: string;
  readonly verificationNote?: string;
}

export const EVIDENCE_TYPES = [
  'MATHEMATICAL',
  'THEORETICAL',
  'EMPIRICAL',
  'ENGINEERING',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const COMPATIBILITY_AXES = [
  'construct',
  'input',
  'output',
  'scale',
  'temporal',
  'parameter',
  'computational',
  'interpretability',
] as const;
export type CompatibilityAxis = (typeof COMPATIBILITY_AXES)[number];

export const COMPATIBILITY_VALUES = [
  'COMPATIBLE',
  'PARTIALLY_COMPATIBLE',
  'INCOMPATIBLE',
  'UNKNOWN',
] as const;
export type CompatibilityValue = (typeof COMPATIBILITY_VALUES)[number];

export interface CompatibilityAssessment {
  readonly value: CompatibilityValue;
  readonly observation?: string;
}

export type CompatibilityProfile = Readonly<
  Record<CompatibilityAxis, CompatibilityAssessment>
>;

export const INTENSITY_CONSTRUCTS = [
  'EVENT_INTENSITY',
  'EMOTIONAL_STATE_INTENSITY',
] as const;
export type IntensityConstruct = (typeof INTENSITY_CONSTRUCTS)[number];

export const MEMORY_CONSTRUCTS = [
  'DECLARATIVE_MEMORY',
  'EMOTIONAL_MEMORY',
  'EMOTIONAL_PERSISTENCE_INERTIA',
] as const;
export type MemoryConstruct = (typeof MEMORY_CONSTRUCTS)[number];

export const RELATION_KINDS = [
  'ASSOCIATION',
  'COUPLING',
  'DEPENDENCY',
  'CAUSALITY',
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Component-specific construct qualifiers; each is required for exactly one component. */
export interface ConstructQualifiers {
  readonly intensityConstruct?: IntensityConstruct;
  readonly memoryConstruct?: MemoryConstruct;
  readonly relationKind?: RelationKind;
}

export interface ConstructMapping {
  readonly emoraConstruct: string;
  readonly candidateConstruct: string;
  readonly qualifiers: ConstructQualifiers;
}

export interface EquationVariable {
  readonly symbol: string;
  readonly definition: string;
  readonly unitsOrScale: string;
}

export interface EquationRepresentation {
  readonly expression: string;
  readonly variables: readonly EquationVariable[];
}

export const SYNTHETIC_EVALUATION_KINDS = [
  'BOUNDEDNESS',
  'DETERMINISM',
  'MONOTONICITY',
  'EDGE_CASE_BEHAVIOR',
  'NUMERICAL_STABILITY',
  'REGRESSION_BEHAVIOR',
  'RUNTIME_COMPATIBILITY',
  'PARAMETER_SENSITIVITY',
] as const;
export type SyntheticEvaluationKind =
  (typeof SYNTHETIC_EVALUATION_KINDS)[number];

export const HUMAN_EVALUATION_KINDS = [
  'TARGET_CONSTRUCT',
  'HUMAN_MEASUREMENT_REQUIREMENT',
  'PARTICIPANT_STRUCTURE',
  'REPEATED_OBSERVATIONS',
  'TIME_SCALE',
  'ANNOTATION_PROCEDURE',
  'MISSINGNESS',
  'INTER_RATER_VARIABILITY',
  'PREDEFINED_EVALUATION_CRITERIA',
  'APPROPRIATE_BASELINE',
  'HELD_OUT_REQUIREMENT',
] as const;
export type HumanEvaluationKind = (typeof HUMAN_EVALUATION_KINDS)[number];

export interface SyntheticEvaluationRequirement {
  readonly kind: SyntheticEvaluationKind;
  readonly description: string;
}

export interface HumanEvaluationRequirement {
  readonly kind: HumanEvaluationKind;
  readonly description: string;
}

/** Engineering/mathematical tests; never evidence of psychological validity. */
export interface SyntheticEvaluationPlan {
  readonly evidenceClass: 'SYNTHETIC_MATHEMATICAL';
  readonly requirements: readonly SyntheticEvaluationRequirement[];
}

/** Future human behavioral methodology requirements; no data, no inference. */
export interface HumanEvaluationPlan {
  readonly evidenceClass: 'HUMAN_BEHAVIORAL';
  readonly requirements: readonly HumanEvaluationRequirement[];
}

export interface CandidateFormulationRecord<
  C extends MathematicalComponent = MathematicalComponent,
> {
  readonly candidateId: string;
  readonly component: C;
  readonly family: CandidateFamily<C>;
  readonly label: string;
  readonly provenance: SourceProvenance;
  readonly equation: EquationRepresentation;
  readonly constructMapping: ConstructMapping;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly scale: string;
  readonly temporalAssumptions: string;
  readonly parameterAssumptions: string;
  readonly compatibility: CompatibilityProfile;
  readonly evidenceTypes: readonly EvidenceType[];
  readonly limitations: readonly string[];
  readonly syntheticEvaluation: SyntheticEvaluationPlan;
  readonly humanEvaluation: HumanEvaluationPlan;
  readonly revisitTriggers: readonly string[];
  readonly analyticalObservations: readonly string[];
}

/** Reference to the governed decision. Supplied by the caller; never computed from candidates. */
export interface GovernedDecisionReference {
  readonly registerVersion: KnownRegisterVersion;
  readonly decisionId: string;
  readonly currentDecision: GovernanceDecision;
}

export interface CandidateComparisonArtifactInput<
  C extends MathematicalComponent = MathematicalComponent,
> {
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly component: C;
  readonly governedDecisionReference: GovernedDecisionReference;
  readonly currentFormulationSummary: string;
  readonly candidates: readonly CandidateFormulationRecord<C>[];
}

export interface CandidateComparisonArtifact<
  C extends MathematicalComponent = MathematicalComponent,
> extends CandidateComparisonArtifactInput<C> {
  readonly scope: 'READ_ONLY_ANALYTICAL';
  /** Deterministic content hash of every field above except this one. */
  readonly artifactHash: string;
}
