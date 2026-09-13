import type { MetricDefinition } from '../contracts';

export const MAE_METRIC_DEFINITION: MetricDefinition = Object.freeze({
  metricId: 'MAE',
  name: 'Mean Absolute Error',
  formulaDescription: 'MAE = (1/N) * sum(|y_i - y_hat_i|)',
  targetType: 'EMOTE_VECTOR_DIMENSION',
  annotationType: 'EXACT_VECTOR',
  scale: 'BOUNDED_0_1',
  assumptions: Object.freeze([
    'MODEL B: sampling unit is one EvaluationCase per observation, for one fixed target dimension, aggregated across the evaluation dataset.',
    'Cross-dimension aggregation within a single case is prohibited; see calculateVectorMAE for the approved per-dimension, multi-case aggregation.',
    'Result scope is run-level, not case-level.',
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
  scale: 'BOUNDED_0_1',
  assumptions: Object.freeze([
    'MODEL B: sampling unit is one EvaluationCase per observation, for one fixed target dimension, aggregated across the evaluation dataset.',
    'Cross-dimension aggregation within a single case is prohibited; see calculateVectorRMSE for the approved per-dimension, multi-case aggregation.',
    'Result scope is run-level, not case-level.',
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
    'MODEL A: sampling unit is the set of ranked EMORA emotion dimensions within a single EvaluationCase/scenario.',
    'Result scope is case-level; do not generalize into a cross-case fixed-dimension metric.',
    'Paired ordinal or rank-ordered observations',
    'Monotonic association measurement',
    'Fractional average rank assignment for ties',
    'Conditionally supported on continuous vectors with explicit rank protocol',
  ]),
});

// KENDALL TAU: DEFERRED — UNDEFINED — REQUIRES METHODOLOGICAL DECISION.
// The exact Kendall variant (tau-a, tau-b, or tau-c) is not yet an approved
// methodological decision. No definition or calculation is provided until
// the variant is explicitly decided; do not assume tau-b by default.

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
