import type { MetricDefinition } from '../contracts';

export const MAE_METRIC_DEFINITION: MetricDefinition = Object.freeze({
  metricId: 'MAE',
  name: 'Mean Absolute Error',
  formulaDescription: 'MAE = (1/N) * sum(|y_i - y_hat_i|)',
  targetType: 'EMOTE_VECTOR_DIMENSION',
  annotationType: 'EXACT_VECTOR',
  scale: 'ERROR_NON_NEGATIVE',
  assumptions: Object.freeze([
    'MODEL B: sampling unit is one EvaluationCase per observation, for one fixed target dimension, aggregated across the evaluation dataset.',
    'Cross-dimension aggregation within a single case is prohibited; see calculateVectorMAE for the approved per-dimension, multi-case aggregation.',
    'Result scope is run-level, not case-level.',
    'Error range is bounded by the evaluated dimension\'s registry range (e.g. [0,1] for EMOTION, [0,2] for valence); not a scientific threshold.',
    'Paired finite numerical observations',
    'Linear uniform error penalization',
    'No silent imputation of missing values',
  ]),
});

export const RMSE_METRIC_DEFINITION: MetricDefinition = Object.freeze({
  metricId: 'RMSE',
  name: 'Root Mean Squared Error',
  formulaDescription: 'RMSE = sqrt((1/N) * sum((y_i - y_hat_i)^2))',
  targetType: 'EMOTE_VECTOR_DIMENSION',
  annotationType: 'EXACT_VECTOR',
  scale: 'ERROR_NON_NEGATIVE',
  assumptions: Object.freeze([
    'MODEL B: sampling unit is one EvaluationCase per observation, for one fixed target dimension, aggregated across the evaluation dataset.',
    'Cross-dimension aggregation within a single case is prohibited; see calculateVectorRMSE for the approved per-dimension, multi-case aggregation.',
    'Result scope is run-level, not case-level.',
    'Error range is bounded by the evaluated dimension\'s registry range (e.g. [0,1] for EMOTION, [0,2] for valence); not a scientific threshold.',
    'Paired finite numerical observations',
    'Quadratic penalization of larger deviations',
    'No silent imputation of missing values',
  ]),
});

export const PEARSON_METRIC_DEFINITION: MetricDefinition = Object.freeze({
  metricId: 'PEARSON_R',
  name: 'Pearson Correlation Coefficient',
  formulaDescription: 'r = sum((y_i - y_bar)*(y_hat_i - y_hat_bar)) / sqrt(sum((y_i - y_bar)^2) * sum((y_hat_i - y_hat_bar)^2))',
  targetType: 'EMOTE_VECTOR_DIMENSION',
  annotationType: 'EXACT_VECTOR',
  scale: 'BOUNDED_MINUS1_1',
  assumptions: Object.freeze([
    'DEFERRED — REQUIRES METHODOLOGICAL DECISION.',
    'The sampling unit and vector-level aggregation semantics for Pearson are not currently defined by an approved EMORA evaluation contract.',
    'No approved vector-level Pearson orchestration equivalent to calculateVectorMAE/calculateVectorRMSE exists.',
    'Paired finite numerical observations',
    'Non-zero variance in both target and prediction series',
    'Linear association measurement without scale or offset calibration',
  ]),
});

export const SPEARMAN_METRIC_DEFINITION: MetricDefinition = Object.freeze({
  metricId: 'SPEARMAN_RHO',
  name: 'Spearman Rank Correlation Coefficient',
  formulaDescription: 'rho = Pearson_r(Rank(y), Rank(y_hat)) with fractional tie-ranking',
  targetType: 'RANK_ORDER',
  annotationType: 'RANKING',
  scale: 'BOUNDED_MINUS1_1',
  assumptions: Object.freeze([
    'MODEL A: sampling unit is one (case, ranking-space); the ranked items are EMORA emotion dimensions within a single EvaluationCase/scenario.',
    'Ranking space is EMOTION only (MDS v1.0 §6.1); mixing CONTINUOUS_AFFECT or COMPUTATIONAL dimensions into a ranking is a MIXED_SEMANTIC_SPACE violation.',
    'Reference targetValues are competition ranks under RANK_1_IS_HIGHEST (MDS v1.0 §6.2/§6.3, A1): integers in [1, n]; ties share a rank and subsequent positions skip (e.g. [1,1,3]); other integer labels are REFERENCE_INVALID.',
    'Reference competition ranks are converted to average ranks for Spearman input (e.g. [1,1,3] -> [1.5,1.5,3]); the original annotation is preserved unchanged.',
    'Model scores are converted to fractional ranks with rank 1 for the highest score; the two transformations are distinct and are not merged.',
    'Result scope is case-level; do not generalize into a cross-case fixed-dimension metric.',
    'Paired ordinal or rank-ordered observations',
    'Monotonic association measurement',
    'Fractional average rank assignment for ties',
    'Technical minimum n >= 2 is a computational requirement, not a scientific threshold.',
  ]),
});

// KENDALL TAU: REMOVED from the Phase 6 roadmap by MDS v1.0 §5.5. No definition,
// calculation, or execution contract is authorized; any future reintroduction
// would require a pre-specified sensitivity-analysis methodology decision.

export const DIRECTIONAL_ACCURACY_DEFINITION: MetricDefinition = Object.freeze({
  metricId: 'DIRECTIONAL_ACCURACY',
  name: 'Directional Sign Accuracy',
  formulaDescription: 'Accuracy = (1/N) * sum(sign(delta_y_i) == sign(delta_y_hat_i) ? 1 : 0)',
  targetType: 'DIRECTIONAL_SIGN',
  annotationType: 'DIRECTIONAL_DELTA',
  scale: 'BOUNDED_0_1',
  assumptions: Object.freeze([
    'UNDEFINED — REQUIRES METHODOLOGICAL DECISION.',
    'DIRECTIONAL_DELTA describes a directional change; whether the sampling unit is one dimension observed across multiple cases, or another model, is not yet approved.',
    'No vector-level orchestration exists.',
    'Paired directional sign indicators in {-1, 0, +1}',
    'Unweighted sign match comparison without arbitrary tolerance',
  ]),
});
