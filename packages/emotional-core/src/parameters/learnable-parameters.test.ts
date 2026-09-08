import { describe, expect, it } from 'vitest';

import {
  createDefaultModelParameters,
  createLearnableParameterSet,
  emotionNames,
  InvalidDomainObjectError,
} from '../index';
import type { LearnableParameterSet } from '../index';

function phase5Confidence(
  base: number,
  uncertainty: number,
  uncertaintyPenalty: number,
  memoryFactor: number,
): number {
  return Math.min(
    1,
    Math.max(0, base * (1 - uncertainty * uncertaintyPenalty) * memoryFactor),
  );
}

function validInput(): LearnableParameterSet {
  const defaults = createDefaultModelParameters();
  return {
    version: 'phase-6.2-a-test-1',
    learnable: {
      eventImpactWeights: { ...defaults.dynamics.eventImpactWeights },
      personalityWeights: { ...defaults.dynamics.personalityWeights },
      emotionWeights: { ...defaults.dynamics.emotionWeights },
      memoryWeights: { ...defaults.dynamics.memoryWeights },
      memoryDecayRate: 1,
      stabilityWeights: {
        rate: defaults.dynamics.stabilityWeights.rate,
        baseline: { ...defaults.dynamics.stabilityWeights.baseline },
      },
      confidenceWeights: { ...defaults.dynamics.confidenceWeights },
    },
    fixed: {
      policyVersion: 'deterministic-interaction-policy-v1',
      interactionWeights: Object.fromEntries(
        emotionNames.map((source) => [
          source,
          { ...defaults.dynamics.interactionWeights[source] },
        ]),
      ),
    },
  } as unknown as LearnableParameterSet;
}

describe('learnable parameter contract', () => {
  it('accepts a complete parameter set with boundary values', () => {
    const result = createLearnableParameterSet(validInput());

    expect(result.version).toBe('phase-6.2-a-test-1');
    expect(result.learnable.memoryDecayRate).toBe(1);
    expect(result.fixed.interactionWeights.fear.trust).toBe(-0.35);
  });

  it('rejects non-finite, null, string, and out-of-range values', () => {
    const invalidValues: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      undefined,
      null,
      '0.5',
      -0.1,
      1.1,
    ];

    for (const value of invalidValues) {
      const base = validInput();
      const input = {
        ...base,
        learnable: {
          ...base.learnable,
          memoryDecayRate: value as number,
        },
      } as unknown as LearnableParameterSet;
      expect(() => createLearnableParameterSet(input)).toThrow(
        InvalidDomainObjectError,
      );
    }
  });

  it('rejects unknown learnable families and incomplete structures', () => {
    const input = validInput() as unknown as Record<string, unknown>;
    expect(() => createLearnableParameterSet({
      ...input,
      unknownFamily: {},
    } as unknown as LearnableParameterSet)).toThrow(InvalidDomainObjectError);

    const base = validInput();
    const incomplete = {
      ...base,
      learnable: {
        ...base.learnable,
        memoryWeights: {},
      },
    } as unknown as LearnableParameterSet;
    expect(() => createLearnableParameterSet(incomplete)).toThrow(
      InvalidDomainObjectError,
    );
  });

  it('keeps the interaction matrix fixed and enforces the canonical policy', () => {
    const input = validInput();
    const invalidSource = {
      ...input,
      fixed: {
        ...input.fixed,
        interactionWeights: {
          ...input.fixed.interactionWeights,
          surprise: { ...input.fixed.interactionWeights.fear },
        },
      },
    } as unknown as LearnableParameterSet;
    expect(() => createLearnableParameterSet(invalidSource)).toThrow(
      InvalidDomainObjectError,
    );

    const base = validInput();
    const invalidSign = {
      ...base,
      fixed: {
        ...base.fixed,
        interactionWeights: {
          ...base.fixed.interactionWeights,
          fear: { ...base.fixed.interactionWeights.fear, trust: 0.1 },
        },
      },
    } as unknown as LearnableParameterSet;
    expect(() => createLearnableParameterSet(invalidSign)).toThrow(
      InvalidDomainObjectError,
    );

    const invalidTrust = validInput();
    const invalidTrustInput = {
      ...invalidTrust,
      learnable: {
        ...invalidTrust.learnable,
        emotionWeights: {
          ...invalidTrust.learnable.emotionWeights,
          trust: {
            ...invalidTrust.learnable.emotionWeights.trust,
            negative: 0.1,
          },
        },
      },
    } as unknown as LearnableParameterSet;
    expect(() => createLearnableParameterSet(invalidTrustInput)).toThrow(
      InvalidDomainObjectError,
    );
  });

  it('deeply freezes the validated parameter set and is deterministic', () => {
    const first = createLearnableParameterSet(validInput());
    const second = createLearnableParameterSet(validInput());

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.learnable)).toBe(true);
    expect(Object.isFrozen(first.learnable.eventImpactWeights)).toBe(true);
    expect(Object.isFrozen(first.fixed.interactionWeights)).toBe(true);
    expect(Object.isFrozen(first.fixed.interactionWeights.fear)).toBe(true);
    expect(() => {
      (first.learnable.personalityWeights as Record<string, number>).emotionalSensitivity = 1;
    }).toThrow();
    expect(() => {
      (first.fixed.interactionWeights.fear as Record<string, number>).trust = 0;
    }).toThrow();
  });

  it('demonstrates the non-strict confidence monotonicities of Phase 5', () => {
    const fixedUncertainty = 0.4;
    const fixedPenalty = 0.7;
    const fixedMemoryFactor = 0.95;
    expect(
      phase5Confidence(0.2, fixedUncertainty, fixedPenalty, fixedMemoryFactor),
    ).toBeLessThanOrEqual(
      phase5Confidence(0.8, fixedUncertainty, fixedPenalty, fixedMemoryFactor),
    );

    const fixedBase = 0.8;
    expect(
      phase5Confidence(fixedBase, 0.2, fixedPenalty, fixedMemoryFactor),
    ).toBeGreaterThanOrEqual(
      phase5Confidence(fixedBase, 0.8, fixedPenalty, fixedMemoryFactor),
    );

    const positiveUncertainty = 0.4;
    expect(
      phase5Confidence(fixedBase, positiveUncertainty, 0.2, fixedMemoryFactor),
    ).toBeGreaterThanOrEqual(
      phase5Confidence(fixedBase, positiveUncertainty, 0.8, fixedMemoryFactor),
    );

    expect(
      phase5Confidence(fixedBase, fixedUncertainty, fixedPenalty, 0.2),
    ).toBeLessThanOrEqual(
      phase5Confidence(fixedBase, fixedUncertainty, fixedPenalty, 0.95),
    );
  });
});