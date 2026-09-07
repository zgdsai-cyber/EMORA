import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import type { EmotionName } from './emotion-vector';

export interface EmotionCoefficient {
  readonly positive: number;
  readonly negative: number;
  readonly uncertainty: number;
  readonly relevance: number;
  readonly surprise: number;
}

export interface TrustEmotionCoefficient {
  readonly positive: number;
  readonly relevance: number;
  readonly surprise: number;
}

export type EmotionWeights = Readonly<{
  readonly trust: TrustEmotionCoefficient;
} & {
  readonly [Emotion in Exclude<EmotionName, 'trust'>]: EmotionCoefficient;
}>;

export interface DynamicsParameterSet {
  readonly eventImpactWeights: Readonly<{ surpriseBase: number; surpriseScale: number }>;
  readonly personalityWeights: Readonly<Record<string, number>>;
  readonly emotionWeights: EmotionWeights;
  readonly interactionWeights: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly memoryWeights: Readonly<Record<string, number>>;
  readonly stabilityWeights: Readonly<{
    rate: number;
    baseline: Readonly<Record<string, number>>;
  }>;
  readonly confidenceWeights: Readonly<Record<string, number>>;
}

export interface ModelParameters {
  readonly sets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly dynamics?: DynamicsParameterSet;
}

export function createModelParameters(input: ModelParameters): ModelParameters {
  for (const [setName, values] of Object.entries(input.sets)) {
    if (!setName) {
      throw new InvalidDomainObjectError('Model parameter sets require names.');
    }
    for (const [name, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) {
        throw new InvalidDomainObjectError(`Model parameter ${setName}.${name} must be finite.`);
      }
    }
  }
  const sets = Object.fromEntries(
    Object.entries(input.sets).map(([setName, values]) => [
      setName,
      Object.freeze({ ...values }),
    ]),
  );
  return Object.freeze({
    sets: Object.freeze(sets),
    dynamics: input.dynamics,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}
