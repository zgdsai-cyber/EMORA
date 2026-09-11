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
