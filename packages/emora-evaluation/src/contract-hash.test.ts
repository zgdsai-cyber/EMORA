import { describe, expect, it } from 'vitest';

import { hashCanonical } from './canonicalize';
import {
  computeEvaluationContractHash,
  EVALUATION_CONTRACT_VERSION,
  EVALUATION_CONTRACT_DEFINITION,
  hashEvaluationContract,
} from './contract-hash';
import { MAE_METRIC_DEFINITION } from './metrics/definitions';

describe('evaluation contract hash (Phase 6.7)', () => {
  it('is deterministic for the frozen contract and uses the existing canonical mechanism', () => {
    expect(computeEvaluationContractHash()).toBe(computeEvaluationContractHash());
    expect(computeEvaluationContractHash()).toBe(hashCanonical(EVALUATION_CONTRACT_DEFINITION));
    expect(computeEvaluationContractHash()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('publishes the Phase 6.11 caller-supplied contract version', () => {
    expect(EVALUATION_CONTRACT_VERSION).toBe('mds-v1.0-pearson-v1');
    expect(computeEvaluationContractHash()).toBe(
      '42a6db1a0f1b0658ee7ce12f5ab84a809d84fa296c41001d92fda1782a3906ed',
    );
    expect(computeEvaluationContractHash()).not.toBe(
      'cf1b71d4dc4e7f7bcbdc3aeb710aa50d0dde3a1614dd1a0562574d440d5ab4ae',
    );
  });

  it('covers metric definitions, the ranking protocol, and the dimension registry', () => {
    expect(EVALUATION_CONTRACT_DEFINITION.metricDefinitions.map((definition) => definition.metricId)).toEqual([
      'MAE', 'RMSE', 'PEARSON_R', 'SPEARMAN_RHO', 'DIRECTIONAL_ACCURACY',
    ]);
    expect(EVALUATION_CONTRACT_DEFINITION.rankingProtocol.rankingConvention).toBe('RANK_1_IS_HIGHEST');
    expect(EVALUATION_CONTRACT_DEFINITION.dimensionRegistry.length).toBe(12);
    expect(Object.isFrozen(EVALUATION_CONTRACT_DEFINITION)).toBe(true);
  });

  it('changes when a relevant contract definition changes', () => {
    const base = computeEvaluationContractHash();
    const changedMetric = hashEvaluationContract({
      ...EVALUATION_CONTRACT_DEFINITION,
      metricDefinitions: EVALUATION_CONTRACT_DEFINITION.metricDefinitions.map((definition) =>
        definition.metricId === 'MAE' ? { ...MAE_METRIC_DEFINITION, scale: 'BOUNDED_0_1' as const } : definition),
    });
    const changedProtocol = hashEvaluationContract({
      ...EVALUATION_CONTRACT_DEFINITION,
      rankingProtocol: { ...EVALUATION_CONTRACT_DEFINITION.rankingProtocol, minimumN: 3 as unknown as 2 },
    });
    const changedRegistry = hashEvaluationContract({
      ...EVALUATION_CONTRACT_DEFINITION,
      dimensionRegistry: EVALUATION_CONTRACT_DEFINITION.dimensionRegistry.slice(1),
    });
    expect(changedMetric).not.toBe(base);
    expect(changedProtocol).not.toBe(base);
    expect(changedRegistry).not.toBe(base);
  });

  it('does not depend on runtime inputs', () => {
    // The hash function takes only the frozen definition; there is no parameter for results, timestamps, or predictions.
    expect(computeEvaluationContractHash.length).toBe(0);
  });
});
