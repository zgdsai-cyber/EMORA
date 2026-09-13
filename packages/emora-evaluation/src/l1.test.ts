import { describe, expect, it } from 'vitest';

import {
  calculateMemoryStrength,
  createDefaultModelParameters,
  createEmotionVector,
  createEmotionalState,
  createEventSource,
  createPersonalityProfile,
  DeterministicEmotionalDynamicsProvider,
} from '@emora/emotional-core';
import type {
  EmotionalEvent,
  EmotionalMemory,
  StateTransitionInput,
  StateTransitionProvider,
} from '@emora/emotional-core';

import {
  canonicalize,
  evaluateEventImpactMonotonicity,
  evaluateMemoryDecay,
  evaluateTemporalStabilityContract,
  runL1Evaluation,
} from './index';

const parameters = createDefaultModelParameters();
const profile = createPersonalityProfile({
  id: 'l1-profile',
  emotionalSensitivity: 0.8,
  baselineTrust: 0.6,
  baselineAnxiety: 0.4,
  attachmentSensitivity: 0.7,
  nostalgiaSensitivity: 0.6,
  jealousySensitivity: 0.7,
});
const currentState = createEmotionalState({
  emotionVector: createEmotionVector({ trust: 0.5, joy: 0.2 }),
  dimensions: { valence: 0, arousal: 0.2, intensity: 0.2, confidence: 0.8 },
  timestamp: '2026-01-01T00:00:00.000Z',
});
const event: EmotionalEvent = {
  id: 'l1-event',
  timestamp: '2026-01-02T00:00:00.000Z',
  source: createEventSource('l1-test'),
  valence: 0.4,
  intensity: 0.8,
  relevance: 0.7,
  surprise: 0.2,
  uncertainty: 0.1,
};
const input: StateTransitionInput = {
  currentState,
  event,
  personalityProfile: profile,
  modelParameters: parameters,
};
const identity = {
  caseId: 'l1-golden-001',
  parameterVersionId: 'local-parameter-version',
  parameterSetHash: 'local-parameter-hash',
  providerIdentifier: 'deterministic-emotional-dynamics',
  providerVersion: '1.0.0',
  runtimeContract: 'phase-6.3-l1-v1',
};

function memory(decayRate: number): EmotionalMemory {
  return {
    id: `memory-${decayRate}`,
    timestamp: '2026-01-01T00:00:00.000Z',
    emotionalState: currentState,
    intensity: 0.8,
    importance: 0.5,
    decayRate,
  };
}

function providerWithOutput(output: unknown): StateTransitionProvider {
  return {
    identifier: 'test-provider',
    modelVersion: { id: 'test', name: 'Test Provider', version: '1.0.0' },
    transition: () => output as ReturnType<DeterministicEmotionalDynamicsProvider['transition']>,
  };
}

describe('L1 canonicalization', () => {
  it('is independent of object key insertion order and preserves array order', () => {
    expect(canonicalize({ b: 2, a: [1, undefined] })).toBe(canonicalize({ a: [1, undefined], b: 2 }));
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it('rejects unsupported and non-finite values', () => {
    expect(() => canonicalize(Number.NaN)).toThrow();
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalize(new Date('2026-01-01T00:00:00.000Z'))).toThrow();
    expect(() => canonicalize(new Map([['key', 'value']]))).toThrow();
    expect(() => canonicalize(new Set(['value']))).toThrow();
  });
});

describe('L1 provider observation', () => {
  it('passes G1, G2, G3, and G7 against the real production provider', () => {
    const report = runL1Evaluation({
      engine: {
        provider: new DeterministicEmotionalDynamicsProvider(),
        runtimeContract: 'phase-6.3-l1-v1',
        engineVersion: '1.0.0',
        engineCommit: 'l1-test-engine-commit',
      },
      evaluationCase: { identity, input },
    });

    expect(report.status).toBe('PASS');
    expect(report.results.map((result) => result.gateId)).toEqual(['G1', 'G2', 'G3', 'G7']);
    expect(report.results.every((result) => result.status === 'PASS')).toBe(true);
    expect(report.reportHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reports invalid input bounds and does not fabricate a result', () => {
    const invalidInput = {
      ...input,
      event: { ...event, surprise: Number.NaN },
    } as StateTransitionInput;
    const report = runL1Evaluation({
      engine: {
        provider: new DeterministicEmotionalDynamicsProvider(),
        runtimeContract: 'phase-6.3-l1-v1',
        engineVersion: '1.0.0',
        engineCommit: 'l1-test-engine-commit',
      },
      evaluationCase: { identity: { ...identity, caseId: 'l1-invalid-input' }, input: invalidInput },
    });

    expect(report.status).toBe('FAIL');
    expect(report.results.every((result) => result.status === 'FAIL')).toBe(true);
    expect(report.results[0].failureReason).toContain('finite');
  });

  it('fails G1 and G2 for an invalid provider output', () => {
    const malformed = { nextState: { emotionVector: { joy: Number.NaN } } };
    const report = runL1Evaluation({
      engine: {
        provider: providerWithOutput(malformed),
        runtimeContract: 'phase-6.3-l1-v1',
        engineVersion: '1.0.0',
        engineCommit: 'l1-test-engine-commit',
      },
      evaluationCase: { identity: { ...identity, caseId: 'l1-invalid-output' }, input },
    });

    expect(report.status).toBe('FAIL');
    expect(report.results.find((result) => result.gateId === 'G1')?.status).toBe('FAIL');
    expect(report.results.find((result) => result.gateId === 'G2')?.status).toBe('FAIL');
  });
});

describe('L1 declared local properties', () => {
  it('checks only direct event-impact monotonicity using the production function', () => {
    const increasedSurpriseEvent = { ...event, id: 'l1-event-surprise', surprise: 0.8 };
    const result = evaluateEventImpactMonotonicity({
      identity: { ...identity, caseId: 'l1-impact-surprise' },
      baseEvent: event,
      increasedSurpriseEvent,
      modelParameters: parameters,
    });

    expect(result.status).toBe('PASS');
  });

  it('does not claim final emotional-state monotonicity', () => {
    const increasedSurpriseEvent = { ...event, id: 'l1-event-surprise', surprise: 0.8 };
    const provider = new DeterministicEmotionalDynamicsProvider();
    const first = provider.transition(input);
    const second = provider.transition({ ...input, event: increasedSurpriseEvent });

    expect(first.nextState).not.toEqual(second.nextState);
  });

  it('checks the explicit rate-zero temporal stability contract', () => {
    const delta = createEmotionVector({ joy: 0.1 });
    const result = evaluateTemporalStabilityContract({
      identity: { ...identity, caseId: 'l1-temporal-rate-zero' },
      currentVector: currentState.emotionVector,
      delta,
      modelParameters: parameters,
    });

    expect(result.status).toBe('PASS');
  });

  it('checks production memory strength for bounds, decay, zero decay, and future memory', () => {
    const zeroDecay = memory(0);
    const result = evaluateMemoryDecay({
      identity: { ...identity, caseId: 'l1-memory-decay' },
      memory: zeroDecay,
      initialReferenceTimestamp: '2026-01-01T00:00:00.000Z',
      laterReferenceTimestamp: '2026-01-02T00:00:00.000Z',
      futureReferenceTimestamp: '2025-12-31T00:00:00.000Z',
    });

    expect(result.status).toBe('PASS');
    expect(calculateMemoryStrength(zeroDecay, '2026-01-02T00:00:00.000Z')).toBeCloseTo(0.4);
  });

  it('checks positive decay is non-increasing over elapsed time', () => {
    const result = evaluateMemoryDecay({
      identity: { ...identity, caseId: 'l1-memory-positive-decay' },
      memory: memory(0.5),
      initialReferenceTimestamp: '2026-01-01T00:00:00.000Z',
      laterReferenceTimestamp: '2026-01-01T00:01:00.000Z',
      futureReferenceTimestamp: '2025-12-31T00:00:00.000Z',
    });

    expect(result.status).toBe('PASS');
  });
});

