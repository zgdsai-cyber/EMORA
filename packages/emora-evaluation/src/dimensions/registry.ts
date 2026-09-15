// MDS v1.0 §3–§6. Authoritative evaluation-layer registry; does not alter emotional-core output.

export type DimensionSemanticClass = 'EMOTION' | 'CONTINUOUS_AFFECT' | 'COMPUTATIONAL';

export interface DimensionDefinition {
  readonly dimensionId: string;
  readonly semanticClass: DimensionSemanticClass;
  readonly range: readonly [number, number];
  /** MDS §4: EMOTION and CONTINUOUS_AFFECT are behavioral targets; COMPUTATIONAL is not. */
  readonly behavioralTarget: boolean;
}

const emotion = (dimensionId: string): DimensionDefinition =>
  Object.freeze({ dimensionId, semanticClass: 'EMOTION', range: Object.freeze([0, 1] as const), behavioralTarget: true });
const affect = (dimensionId: string, range: readonly [number, number]): DimensionDefinition =>
  Object.freeze({ dimensionId, semanticClass: 'CONTINUOUS_AFFECT', range: Object.freeze(range), behavioralTarget: true });
const computational = (dimensionId: string, range: readonly [number, number]): DimensionDefinition =>
  Object.freeze({ dimensionId, semanticClass: 'COMPUTATIONAL', range: Object.freeze(range), behavioralTarget: false });

export const EMOTION_DIMENSION_IDS = Object.freeze([
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
] as const);

export const DIMENSION_REGISTRY: readonly DimensionDefinition[] = Object.freeze([
  ...EMOTION_DIMENSION_IDS.map(emotion),
  affect('valence', [-1, 1]),
  affect('arousal', [0, 1]),
  affect('intensity', [0, 1]),
  computational('confidence', [0, 1]),
  computational('confidenceAdjustment', [-1, 1]),
]);

const registryById: ReadonlyMap<string, DimensionDefinition> = new Map(
  DIMENSION_REGISTRY.map((definition) => [definition.dimensionId, definition]),
);

/** Returns undefined for unknown dimensions; callers must report UNKNOWN_DIMENSION, never ignore (MDS §3.4). */
export function classifyDimension(dimensionId: string): DimensionDefinition | undefined {
  return registryById.get(dimensionId);
}

export function isBehavioralTarget(dimensionId: string): boolean {
  return classifyDimension(dimensionId)?.behavioralTarget === true;
}

export type RankingSpaceId = 'EMOTION';
export type RankingConvention = 'RANK_1_IS_HIGHEST';

/** MDS §6 (A1 amendment): the only authorized Spearman ranking protocol. */
export const SPEARMAN_RANKING_PROTOCOL = Object.freeze({
  rankingSpace: 'EMOTION' as RankingSpaceId,
  rankingConvention: 'RANK_1_IS_HIGHEST' as RankingConvention,
  /** Reference targetValues are competition ranks: integers in [1, n], ties share a rank, later positions skip. */
  referenceRepresentation: 'COMPETITION_RANKS',
  /** Reference competition ranks are converted to average ranks for Spearman input; the annotation itself is preserved. */
  referenceTieTransformation: 'AVERAGE_RANK',
  /** Model continuous scores are converted to fractional ranks (rank 1 = highest score). */
  modelScoreTransformation: 'FRACTIONAL_RANK',
  minimumN: 2,
  rankableDimensionIds: EMOTION_DIMENSION_IDS,
});
