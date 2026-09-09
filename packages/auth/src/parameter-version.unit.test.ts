import { describe, expect, it } from 'vitest';

import { createDefaultModelParameters } from '@emora/emotional-core';
import type { LearnableParameterSet } from '@emora/emotional-core';

process.env.AUTH_SECRET ??= 'unit-test-only-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

function buildParameterSet(overrideStabilityRate?: number): LearnableParameterSet {
  const defaults = createDefaultModelParameters();
  return {
    version: 'hash-test',
    learnable: {
      eventImpactWeights: { ...defaults.dynamics.eventImpactWeights },
      personalityWeights: { ...defaults.dynamics.personalityWeights },
      emotionWeights: { ...defaults.dynamics.emotionWeights },
      memoryWeights: { ...defaults.dynamics.memoryWeights },
      memoryDecayRate: 1,
      stabilityWeights: {
        rate: overrideStabilityRate ?? defaults.dynamics.stabilityWeights.rate,
        baseline: { ...defaults.dynamics.stabilityWeights.baseline },
      },
      confidenceWeights: { ...defaults.dynamics.confidenceWeights },
    },
    fixed: {
      policyVersion: 'deterministic-interaction-policy-v1',
      interactionWeights: Object.fromEntries(
        Object.entries(defaults.dynamics.interactionWeights).map(([source, targets]) => [
          source,
          { ...targets },
        ]),
      ),
    },
  } as unknown as LearnableParameterSet;
}

describe('hashLearnableParameterSet', () => {
  it('produces the same hash regardless of top-level object key insertion order', async () => {
    const { hashLearnableParameterSet } = await import('./parameter-version');
    const original = buildParameterSet();
    const record = original as unknown as Record<string, unknown>;
    const reordered = {
      fixed: record.fixed,
      learnable: record.learnable,
      version: record.version,
    } as unknown as LearnableParameterSet;

    expect(hashLearnableParameterSet(original)).toBe(hashLearnableParameterSet(reordered));
  });

  it('produces the same hash regardless of nested object key insertion order', async () => {
    const { hashLearnableParameterSet } = await import('./parameter-version');
    const original = buildParameterSet();
    const learnable = original.learnable as unknown as Record<string, unknown>;
    const reorderedLearnable = {
      confidenceWeights: learnable.confidenceWeights,
      stabilityWeights: learnable.stabilityWeights,
      memoryWeights: learnable.memoryWeights,
      memoryDecayRate: learnable.memoryDecayRate,
      emotionWeights: learnable.emotionWeights,
      personalityWeights: learnable.personalityWeights,
      eventImpactWeights: learnable.eventImpactWeights,
    };
    const reordered = {
      ...(original as unknown as Record<string, unknown>),
      learnable: reorderedLearnable,
    } as unknown as LearnableParameterSet;

    expect(hashLearnableParameterSet(original)).toBe(hashLearnableParameterSet(reordered));
  });

  it('produces a different hash when a learnable value changes', async () => {
    const { hashLearnableParameterSet } = await import('./parameter-version');
    const original = buildParameterSet();
    const mutated = buildParameterSet(0.123456);

    expect(hashLearnableParameterSet(original)).not.toBe(hashLearnableParameterSet(mutated));
  });

  it('rejects incomplete parameter sets instead of silently hashing them', async () => {
    const { hashLearnableParameterSet } = await import('./parameter-version');
    const incomplete = { version: 'broken' } as unknown as LearnableParameterSet;

    expect(() => hashLearnableParameterSet(incomplete)).toThrow();
  });

  it('rejects parameter sets containing non-finite numeric values', async () => {
    const { hashLearnableParameterSet } = await import('./parameter-version');
    const original = buildParameterSet();
    const withNaN = {
      ...(original as unknown as Record<string, unknown>),
      learnable: {
        ...(original.learnable as unknown as Record<string, unknown>),
        memoryDecayRate: Number.NaN,
      },
    } as unknown as LearnableParameterSet;

    expect(() => hashLearnableParameterSet(withNaN)).toThrow();
  });
});
