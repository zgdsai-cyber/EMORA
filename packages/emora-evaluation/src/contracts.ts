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

export interface EvaluationDataset {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
  readonly referenceType: ReferenceType;
  readonly title: string;
  readonly description: string;
  readonly casesCount: number;
  readonly cases: readonly EvaluationCase[];
  readonly provenanceMetadata: Readonly<Record<string, unknown>>;
}

export interface ModelObservation {
  readonly caseId: string;
  readonly observedValues: Readonly<Record<string, unknown>>;
  readonly executionTimestamp?: string;
}

export interface MetricDefinition {
  readonly metricId: string;
  readonly name: string;
  readonly formulaDescription: string;
  readonly targetType: EmotionTargetType;
  readonly annotationType: AnnotationType;
  readonly scale: 'BOUNDED_0_1' | 'BOUNDED_MINUS1_1' | 'ORDINAL' | 'UNBOUNDED';
  readonly assumptions: readonly string[];
}

export interface MetricResult {
  readonly metricId: string;
  readonly dimension: string;
  readonly value: number;
  readonly sampleSize: number;
  readonly missingCasesCount: number;
  readonly status: 'COMPUTED' | 'INVALID' | 'INSUFFICIENT_DATA';
  readonly failureReason?: string;
}
