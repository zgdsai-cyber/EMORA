import {
  applyTemporalStability,
  calculateEventImpact,
  calculateMemoryStrength,
  emotionNames,
  validateEmotionalDimensions,
  validateEmotionVector,
  validateModelParameters,
} from '@emora/emotional-core';

import { canonicalize } from './canonicalize';
import type {
  EventImpactMonotonicityProbe,
  GateResult,
  L1EvaluationCase,
  MemoryDecayProbe,
  TemporalStabilityProbe,
} from './contracts';

const NUMERIC_TOLERANCE = 1e-12;

function result(
  identity: L1EvaluationCase['identity'] | EventImpactMonotonicityProbe['identity'] | MemoryDecayProbe['identity'] | TemporalStabilityProbe['identity'],
  gateId: GateResult['gateId'],
  status: GateResult['status'],
  property: string,
  observedValue: unknown,
  expected: string,
  failureReason?: string,
): GateResult {
  return {
    gateId,
    status,
    caseId: identity.caseId,
    property,
    observedValue,
    expected,
    tolerance: `absolute numeric tolerance ${NUMERIC_TOLERANCE}`,
    inputReference: identity.caseId,
    parameterVersionId: identity.parameterVersionId,
    parameterSetHash: identity.parameterSetHash,
    providerIdentifier: identity.providerIdentifier,
    providerVersion: identity.providerVersion,
    runtimeContract: identity.runtimeContract,
    failureReason,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inspectOutput(output: unknown) {
  if (!output || typeof output !== 'object') return { valid: false, reason: 'Output is not an object.' };
  const candidate = output as { nextState?: unknown; explanationMetadata?: unknown; confidenceAdjustment?: unknown };
  if (!candidate.nextState || typeof candidate.nextState !== 'object') {
    return { valid: false, reason: 'Output is missing nextState.' };
  }
  const state = candidate.nextState as {
    emotionVector?: unknown;
    dimensions?: unknown;
    timestamp?: unknown;
  };
  try {
    validateEmotionVector(state.emotionVector as Parameters<typeof validateEmotionVector>[0]);
    validateEmotionalDimensions(state.dimensions as Parameters<typeof validateEmotionalDimensions>[0]);
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'State structure is invalid.' };
  }
  if (typeof state.timestamp !== 'string') return { valid: false, reason: 'nextState.timestamp is not a string.' };
  if (candidate.explanationMetadata === undefined || candidate.explanationMetadata === null) {
    return { valid: false, reason: 'explanationMetadata is required.' };
  }
  if (!isFiniteNumber((state.dimensions as { confidence: unknown }).confidence)) {
    return { valid: false, reason: 'confidence is not finite.' };
  }
  if (candidate.confidenceAdjustment !== undefined && !isFiniteNumber(candidate.confidenceAdjustment)) {
    return { valid: false, reason: 'confidenceAdjustment is not finite.' };
  }
  return { valid: true, reason: undefined };
}

export function evaluateBounds(
  evaluationCase: L1EvaluationCase,
  output: unknown,
): GateResult {
  const inspected = inspectOutput(output);
  if (!inspected.valid) {
    return result(
      evaluationCase.identity,
      'G1',
      'FAIL',
      'All provider output numeric values are finite and within declared ranges.',
      inspected.reason,
      'Every emotion value is in [0,1]; valence is in [-1,1]; arousal, intensity, and confidence are in [0,1].',
      inspected.reason,
    );
  }
  return result(
    evaluationCase.identity,
    'G1',
    'PASS',
    'All provider output numeric values are finite and within declared ranges.',
    output,
    'Every emotion value is in [0,1]; valence is in [-1,1]; arousal, intensity, and confidence are in [0,1].',
  );
}

export function evaluateStructuralInvariants(
  evaluationCase: L1EvaluationCase,
  output: unknown,
): GateResult {
  const inspected = inspectOutput(output);
  if (!inspected.valid) {
    return result(
      evaluationCase.identity,
      'G2',
      'FAIL',
      'Provider output preserves the declared state and explanation structure.',
      inspected.reason,
      'nextState, dimensions, emotion dimensions, confidence, timestamp, and explanationMetadata are present and valid.',
      inspected.reason,
    );
  }
  const candidate = output as { nextState: { emotionVector: Record<string, unknown>; dimensions: Record<string, unknown> }; explanationMetadata: Record<string, unknown> };
  const requiredEmotions = emotionNames.every((emotion: string) => Object.hasOwn(candidate.nextState.emotionVector, emotion));
  const requiredExplanation = ['eventImpact', 'personalityModifiers', 'baseInfluence', 'interactionInfluence', 'memoryInfluence', 'stabilityInfluence', 'confidenceFactors']
    .every((key) => Object.hasOwn(candidate.explanationMetadata, key));
  const immutable = Object.isFrozen(output) && Object.isFrozen(candidate.nextState) && Object.isFrozen(candidate.nextState.emotionVector);
  if (!requiredEmotions || !requiredExplanation || !immutable) {
    return result(
      evaluationCase.identity,
      'G2',
      'FAIL',
      'Provider output preserves the declared state and explanation structure.',
      { requiredEmotions, requiredExplanation, immutable },
      'All seven emotion dimensions, all explanation fields, and exposed result/state/vector objects are present and frozen.',
      'Required structure or exposed immutability is missing.',
    );
  }
  return result(
    evaluationCase.identity,
    'G2',
    'PASS',
    'Provider output preserves the declared state and explanation structure.',
    { requiredEmotions, requiredExplanation, immutable },
    'All seven emotion dimensions, all explanation fields, and exposed result/state/vector objects are present and frozen.',
  );
}

export function evaluateDeterminism(
  evaluationCase: L1EvaluationCase,
  firstOutput: unknown,
  secondOutput: unknown,
): GateResult {
  let firstCanonical: string;
  let secondCanonical: string;
  try {
    firstCanonical = canonicalize(firstOutput);
    secondCanonical = canonicalize(secondOutput);
  } catch (error) {
    return result(
      evaluationCase.identity,
      'G3',
      'FAIL',
      'Same provider, input, parameters, and runtime contract produce the same canonical output.',
      error instanceof Error ? error.message : 'Canonicalization failed.',
      'Canonical outputs are equal without relying on insertion order.',
      'Output canonicalization failed.',
    );
  }
  const equal = firstCanonical === secondCanonical;
  return result(
    evaluationCase.identity,
    'G3',
    equal ? 'PASS' : 'FAIL',
    'Same provider, input, parameters, and runtime contract produce the same canonical output.',
    { equal, firstCanonical, secondCanonical },
    'Canonical outputs are equal without relying on insertion order.',
    equal ? undefined : 'Repeated production executions produced different canonical outputs.',
  );
}

export function evaluateConfidenceIntegrity(
  evaluationCase: L1EvaluationCase,
  output: unknown,
): GateResult {
  const inspected = inspectOutput(output);
  if (!inspected.valid) {
    return result(
      evaluationCase.identity,
      'G7',
      'FAIL',
      'Confidence is a finite computational state-estimation value in [0,1].',
      inspected.reason,
      'Confidence is finite and in [0,1]; invalid inputs do not produce a confidence value.',
      inspected.reason,
    );
  }
  const confidence = (output as { nextState: { dimensions: { confidence: number } } }).nextState.dimensions.confidence;
  return result(
    evaluationCase.identity,
    'G7',
    'PASS',
    'Confidence is a finite computational state-estimation value in [0,1].',
    confidence,
    'Confidence is finite and in [0,1]; invalid inputs do not produce a confidence value.',
  );
}

export function evaluateEventImpactMonotonicity(probe: EventImpactMonotonicityProbe): GateResult {
  const base = calculateEventImpact(probe.baseEvent, probe.modelParameters);
  const increased = calculateEventImpact(probe.increasedSurpriseEvent, probe.modelParameters);
  const validDomain = probe.increasedSurpriseEvent.surprise >= probe.baseEvent.surprise;
  const passes = validDomain && increased + NUMERIC_TOLERANCE >= base;
  return result(
    probe.identity,
    'G4',
    passes ? 'PASS' : 'FAIL',
    'Local event impact is non-decreasing when only surprise increases within [0,1].',
    { base, increased, baseSurprise: probe.baseEvent.surprise, increasedSurprise: probe.increasedSurpriseEvent.surprise },
    'For the production calculateEventImpact function, increased surprise with non-negative validated coefficients does not decrease direct impact.',
    passes ? undefined : 'The local direct-impact property was violated or the probe domain was invalid.',
  );
}

export function evaluateTemporalStabilityContract(probe: TemporalStabilityProbe): GateResult {
  const parameters = validateModelParameters(probe.modelParameters);
  const zeroRateParameters = {
    ...parameters,
    dynamics: { ...parameters.dynamics, stabilityWeights: { ...parameters.dynamics.stabilityWeights, rate: 0 } },
  };
  const alternateBaselineParameters = {
    ...zeroRateParameters,
    dynamics: {
      ...zeroRateParameters.dynamics,
      stabilityWeights: {
        ...zeroRateParameters.dynamics.stabilityWeights,
        baseline: Object.fromEntries(emotionNames.map((emotion: string) => [emotion, 1 - zeroRateParameters.dynamics.stabilityWeights.baseline[emotion]])),
      },
    },
  };
  const first = applyTemporalStability(probe.currentVector, probe.delta, zeroRateParameters);
  const second = applyTemporalStability(probe.currentVector, probe.delta, alternateBaselineParameters);
  const equal = canonicalize(first) === canonicalize(second);
  return result(
    probe.identity,
    'G5',
    equal ? 'PASS' : 'FAIL',
    'A zero stability rate disables the baseline pull while preserving the production output bounds.',
    { equal, first, second },
    'Changing only the baseline at stability rate 0 does not change applyTemporalStability output.',
    equal ? undefined : 'The explicit rate-zero contract was violated.',
  );
}

export function evaluateMemoryDecay(probe: MemoryDecayProbe): GateResult {
  const initial = calculateMemoryStrength(probe.memory, probe.initialReferenceTimestamp);
  const later = calculateMemoryStrength(probe.memory, probe.laterReferenceTimestamp);
  const future = calculateMemoryStrength(probe.memory, probe.futureReferenceTimestamp);
  const finiteAndBounded = [initial, later, future].every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  const nonIncreasing = later <= initial + NUMERIC_TOLERANCE;
  const futureIgnored = future === 0;
  const zeroDecayStable = probe.memory.decayRate !== 0 || Math.abs(later - initial) <= NUMERIC_TOLERANCE;
  const passes = finiteAndBounded && nonIncreasing && futureIgnored && zeroDecayStable;
  return result(
    probe.identity,
    'G6',
    passes ? 'PASS' : 'FAIL',
    'Production calculateMemoryStrength is finite, bounded, non-increasing over elapsed time, stable at zero decay, and ignores future memories.',
    { initial, later, future, finiteAndBounded, nonIncreasing, futureIgnored, zeroDecayStable },
    'Strength remains in [0,1], does not increase as elapsed time grows, is unchanged by elapsed time at decayRate 0, and future memory returns 0.',
    passes ? undefined : 'The declared memory-strength property was violated.',
  );
}

