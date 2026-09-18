import type {
  CandidateComparisonArtifact,
  CandidateFamily,
  GovernedDecisionReference,
  MathematicalComponent,
} from '../candidate-comparison/contracts';

export const SYNTHETIC_PROPERTY_STATUSES = [
  'SATISFIED',
  'VIOLATED',
  'NOT_APPLICABLE',
  'NOT_EVALUABLE',
] as const;
export type SyntheticPropertyStatus =
  (typeof SYNTHETIC_PROPERTY_STATUSES)[number];

export type ReevaluableComponent = Exclude<
  MathematicalComponent,
  'HYBRID_FUSION'
>;

export const SYNTHETIC_PROPERTY_FAMILIES_BY_COMPONENT = Object.freeze({
  EVENT_IMPACT: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
    'PARAMETER_SENSITIVITY',
  ],
  PERSONALITY_MODIFIER: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
    'PARAMETER_SENSITIVITY',
  ],
  VALENCE: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
    'PARAMETER_SENSITIVITY',
  ],
  AROUSAL: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
  ],
  INTENSITY: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
  ],
  MEMORY: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
    'TEMPORAL_BEHAVIOR',
    'PARAMETER_SENSITIVITY_IDENTIFIABILITY',
  ],
  TEMPORAL_DYNAMICS: [
    'BOUNDS_INVARIANTS',
    'MONOTONICITY',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
    'TEMPORAL_BEHAVIOR',
    'PARAMETER_SENSITIVITY_IDENTIFIABILITY',
  ],
  INTERACTION_MATRIX: [
    'BOUNDS_INVARIANTS',
    'INPUT_SENSITIVITY',
    'EDGE_LIMITING_CASES',
    'DETERMINISM',
    'NUMERICAL_STABILITY',
    'PARAMETER_SENSITIVITY_IDENTIFIABILITY',
  ],
} as const) satisfies Readonly<Record<ReevaluableComponent, readonly string[]>>;

export type SyntheticPropertyFamily<C extends ReevaluableComponent> =
  (typeof SYNTHETIC_PROPERTY_FAMILIES_BY_COMPONENT)[C][number];

export interface NumericTolerance {
  readonly absolute: number;
  readonly relative: number;
  readonly rationale: string;
}

export interface FormulationVariableSpecification {
  readonly symbol: string;
  readonly definition: string;
  readonly domain: string;
  readonly scaleOrUnits: string;
}

export interface FormulationParameterSpecification {
  readonly symbol: string;
  readonly definition: string;
  readonly domain: string;
  readonly scaleOrUnits: string;
}

/** Optional fields allow incomplete candidates to be recorded as NOT_EVALUABLE. */
export interface ExecutableFormulationSpecification<
  C extends ReevaluableComponent = ReevaluableComponent,
> {
  readonly formulationId: string;
  readonly formulationVersion: string;
  readonly formulationKind: 'CURRENT_EMORA' | 'CANDIDATE';
  readonly component: C;
  readonly construct?: string;
  readonly equation?: {
    readonly expression: string;
    readonly variables: readonly FormulationVariableSpecification[];
  };
  readonly inputDomain?: string;
  readonly outputScale?: string;
  readonly outputUnits?: string;
  readonly parameters?: readonly FormulationParameterSpecification[];
  readonly temporalAssumptions?: string;
  /** Required authority for both current and candidate formulations. */
  readonly governedDecisionReference?: GovernedDecisionReference;
  /** Required for CANDIDATE; forbidden for CURRENT_EMORA. */
  readonly candidateReference?: {
    readonly comparisonArtifact: CandidateComparisonArtifact<C>;
    readonly candidateId: string;
    readonly family: CandidateFamily<C>;
  };
}

export interface SyntheticRunDefinition {
  readonly runId: string;
  readonly input: Readonly<Record<string, number>>;
}

export type SyntheticAssertion =
  | {
      readonly kind: 'FINITE_OUTPUTS';
      readonly runId: string;
      readonly outputKeys: readonly string[];
    }
  | {
      readonly kind: 'OUTPUT_IN_RANGE';
      readonly runId: string;
      readonly outputKey: string;
      readonly minimum: number;
      readonly maximum: number;
    }
  | {
      readonly kind: 'OUTPUT_APPROX_EQUALS';
      readonly runId: string;
      readonly outputKey: string;
      readonly expected: number;
    }
  | {
      readonly kind: 'NON_DECREASING' | 'NON_INCREASING';
      readonly firstRunId: string;
      readonly secondRunId: string;
      readonly outputKey: string;
    }
  | {
      readonly kind: 'MINIMUM_ABSOLUTE_DIFFERENCE';
      readonly firstRunId: string;
      readonly secondRunId: string;
      readonly outputKey: string;
      readonly minimumDifference: number;
    };

export interface SyntheticPropertyCase<C extends ReevaluableComponent> {
  readonly caseId: string;
  readonly propertyFamily: SyntheticPropertyFamily<C>;
  readonly property: string;
  readonly applicability: 'EXECUTABLE' | 'NOT_APPLICABLE';
  readonly reason?: string;
  readonly runs: readonly SyntheticRunDefinition[];
  readonly assertion?: SyntheticAssertion;
}

export interface SyntheticReevaluationProvenance {
  readonly methodologyVersion: string;
  readonly engineCommit: string;
  readonly executorId: string;
  readonly executorVersion: string;
  readonly executorHash: string;
  readonly toolchainIdentity: string;
  readonly configurationHash: string;
}

export interface SyntheticReevaluationPlan<C extends ReevaluableComponent> {
  readonly planId: string;
  readonly planVersion: string;
  readonly component: C;
  readonly formulation: ExecutableFormulationSpecification<C>;
  readonly tolerance: NumericTolerance;
  readonly provenance: SyntheticReevaluationProvenance;
  readonly cases: readonly SyntheticPropertyCase<C>[];
}

export type NumericFormulationExecutor = (
  input: Readonly<Record<string, number>>,
) => Readonly<Record<string, number>>;

export type SyntheticObservedValue =
  | number
  | 'NaN'
  | 'POSITIVE_INFINITY'
  | 'NEGATIVE_INFINITY';

export interface SyntheticRunObservation {
  readonly runId: string;
  readonly input: Readonly<Record<string, number>>;
  readonly output: Readonly<Record<string, SyntheticObservedValue>>;
  readonly repeatedOutput: Readonly<Record<string, SyntheticObservedValue>>;
}

export interface SyntheticCounterexample {
  readonly caseId: string;
  readonly property: string;
  readonly runs: readonly SyntheticRunObservation[];
  readonly expected: string;
  readonly observed: string;
}

export interface SyntheticPropertyResult {
  readonly caseId: string;
  readonly propertyFamily: string;
  readonly property: string;
  readonly status: SyntheticPropertyStatus;
  readonly observations: readonly SyntheticRunObservation[];
  readonly expected?: string;
  readonly observed?: string;
  readonly reason?: string;
  readonly counterexample?: SyntheticCounterexample;
}

export interface SyntheticReevaluationArtifact<C extends ReevaluableComponent>
  extends SyntheticReevaluationPlan<C> {
  readonly scope: 'COMPONENT_LOCAL_SYNTHETIC_MATHEMATICAL';
  readonly disposition: 'EVALUATED';
  readonly results: readonly SyntheticPropertyResult[];
  readonly artifactHash: string;
}

export interface DeferredHybridFusionArtifact {
  readonly component: 'HYBRID_FUSION';
  readonly scope: 'COMPONENT_LOCAL_SYNTHETIC_MATHEMATICAL';
  readonly disposition: 'DEFERRED';
  readonly reason: string;
  readonly artifactHash: string;
}
