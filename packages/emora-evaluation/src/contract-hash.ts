import { hashCanonical } from './canonicalize';
import type { DimensionDefinition } from './dimensions/registry';
import { DIMENSION_REGISTRY, SPEARMAN_RANKING_PROTOCOL } from './dimensions/registry';
import type { MetricDefinition } from './contracts';
import {
  DIRECTIONAL_ACCURACY_DEFINITION,
  MAE_METRIC_DEFINITION,
  PEARSON_METRIC_DEFINITION,
  RMSE_METRIC_DEFINITION,
  SPEARMAN_METRIC_DEFINITION,
} from './metrics/definitions';

/** Frozen, runtime-independent definition of the evaluation contract; no results, timestamps, or model output. */
export interface EvaluationContractDefinition {
  readonly metricDefinitions: readonly MetricDefinition[];
  readonly rankingProtocol: typeof SPEARMAN_RANKING_PROTOCOL;
  readonly dimensionRegistry: readonly DimensionDefinition[];
}

export const EVALUATION_CONTRACT_DEFINITION: EvaluationContractDefinition = Object.freeze({
  metricDefinitions: Object.freeze([
    MAE_METRIC_DEFINITION,
    RMSE_METRIC_DEFINITION,
    PEARSON_METRIC_DEFINITION,
    SPEARMAN_METRIC_DEFINITION,
    DIRECTIONAL_ACCURACY_DEFINITION,
  ]),
  rankingProtocol: SPEARMAN_RANKING_PROTOCOL,
  dimensionRegistry: DIMENSION_REGISTRY,
});

export function hashEvaluationContract(definition: EvaluationContractDefinition): string {
  return hashCanonical(definition);
}

/** Deterministic hash of the frozen evaluation contract (Phase 6.7 technical provenance). */
export function computeEvaluationContractHash(): string {
  return hashEvaluationContract(EVALUATION_CONTRACT_DEFINITION);
}
