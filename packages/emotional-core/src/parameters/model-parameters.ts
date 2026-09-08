import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { emotionNames } from '../domain/emotion-vector';
import type { EmotionName } from '../domain/emotion-vector';
import type {
  DynamicsParameterSet,
  ModelParameters,
} from '../domain/model-parameters';
import { validateInteractionPolicy } from '../dynamics/interaction-policy';

export interface DeterministicModelParameters extends ModelParameters {
  readonly dynamics: DynamicsParameterSet;
}

const emotionCoefficients = (overrides: Partial<Record<string, number>> = {}) =>
  Object.freeze({
    positive: 0,
    negative: 0,
    uncertainty: 0,
    relevance: 0,
    surprise: 0,
    ...overrides,
  });

const emptyEmotionRecord = () =>
  Object.freeze(
    Object.fromEntries(emotionNames.map((emotion) => [emotion, 0])) as Record<
      EmotionName,
      number
    >,
  );

export function createDefaultModelParameters(): DeterministicModelParameters {
  const interactionWeights = Object.freeze(
    Object.fromEntries(
      emotionNames.map((source) => [
        source,
        Object.freeze(
          Object.fromEntries(
            emotionNames.map((target) => [target, 0]),
          ) as Record<EmotionName, number>,
        ),
      ]),
    ) as Record<EmotionName, Readonly<Record<EmotionName, number>>>,
  );

  return Object.freeze({
    sets: Object.freeze({}),
    dynamics: Object.freeze({
      eventImpactWeights: Object.freeze({
        surpriseBase: 0.5,
        surpriseScale: 0.5,
      }),
      personalityWeights: Object.freeze({
        emotionalSensitivity: 0.4,
        baselineTrust: 0.3,
        baselineAnxiety: 0.4,
        attachmentSensitivity: 0.4,
        nostalgiaSensitivity: 0.4,
        jealousySensitivity: 0.4,
      }),
      emotionWeights: Object.freeze({
        love: emotionCoefficients({ positive: 0.8, relevance: 0.2 }),
        fear: emotionCoefficients({ negative: 0.8, uncertainty: 0.7 }),
        nostalgia: emotionCoefficients({ relevance: 0.7, surprise: 0.3 }),
        jealousy: emotionCoefficients({ uncertainty: 0.7, negative: 0.4 }),
        trust: emotionCoefficients({ positive: 0.7 }),
        anger: emotionCoefficients({ negative: 0.7, relevance: 0.3 }),
        joy: emotionCoefficients({ positive: 0.9, surprise: 0.1 }),
      }),
      interactionWeights: Object.freeze({
        ...interactionWeights,
        fear: Object.freeze({
          ...interactionWeights.fear,
          trust: -0.35,
          anger: 0.2,
        }),
        anger: Object.freeze({ ...interactionWeights.anger, trust: -0.3 }),
        joy: Object.freeze({ ...interactionWeights.joy, love: 0.25 }),
        love: Object.freeze({ ...interactionWeights.love, trust: 0.2 }),
      }),
      memoryWeights: Object.freeze({
        ...emptyEmotionRecord(),
        love: 0.35,
        fear: 0.35,
        nostalgia: 0.5,
        jealousy: 0.3,
        trust: 0.35,
        anger: 0.3,
        joy: 0.35,
      }),
      stabilityWeights: Object.freeze({
        rate: 0.1,
        baseline: Object.freeze({
          love: 0.1,
          fear: 0.1,
          nostalgia: 0.1,
          jealousy: 0.1,
          trust: 0.5,
          anger: 0.1,
          joy: 0.2,
        }),
      }),
      confidenceWeights: Object.freeze({
        base: 0.8,
        uncertaintyPenalty: 0.7,
        memoryWithData: 0.95,
        memoryWithoutData: 0.85,
      }),
    }),
  });
}

function validateFinite(
  value: number,
  name: string,
  minimum?: number,
  maximum?: number,
) {
  if (
    !Number.isFinite(value) ||
    (minimum !== undefined && value < minimum) ||
    (maximum !== undefined && value > maximum)
  ) {
    throw new InvalidDomainObjectError(
      `Model parameter ${name} must be a valid finite value.`,
    );
  }
}

export function validateModelParameters(
  input: ModelParameters,
): DeterministicModelParameters {
  for (const [setName, values] of Object.entries(input.sets)) {
    if (!setName) {
      throw new InvalidDomainObjectError('Model parameter sets require names.');
    }
    for (const [name, value] of Object.entries(values)) {
      validateFinite(value, `sets.${setName}.${name}`);
    }
  }
  const defaults = createDefaultModelParameters();
  const dynamics = input.dynamics ?? defaults.dynamics;
  const configuredTrustWeights = dynamics.emotionWeights
    .trust as unknown as Record<string, number>;
  if (
    Object.prototype.hasOwnProperty.call(configuredTrustWeights, 'negative') &&
    configuredTrustWeights.negative !== 0
  ) {
    throw new InvalidDomainObjectError(
      'Model parameter emotionWeights.trust.negative must be zero or omitted.',
    );
  }
  validateFinite(
    dynamics.eventImpactWeights.surpriseBase,
    'eventImpactWeights.surpriseBase',
    0,
    1,
  );
  validateFinite(
    dynamics.eventImpactWeights.surpriseScale,
    'eventImpactWeights.surpriseScale',
    0,
    1,
  );

  for (const [name, value] of Object.entries(dynamics.personalityWeights)) {
    validateFinite(value, `personalityWeights.${name}`, 0, 2);
  }
  validateInteractionPolicy(dynamics.interactionWeights);
  for (const emotion of emotionNames) {
    for (const [name, value] of Object.entries(
      dynamics.emotionWeights[emotion],
    )) {
      validateFinite(value, `emotionWeights.${emotion}.${name}`, 0, 2);
    }
    validateFinite(
      dynamics.memoryWeights[emotion],
      `memoryWeights.${emotion}`,
      0,
      1,
    );
    validateFinite(
      dynamics.stabilityWeights.baseline[emotion],
      `stabilityWeights.baseline.${emotion}`,
      0,
      1,
    );
    for (const [target, value] of Object.entries(
      dynamics.interactionWeights[emotion],
    )) {
      validateFinite(value, `interactionWeights.${emotion}.${target}`, -1, 1);
    }
  }
  validateFinite(dynamics.stabilityWeights.rate, 'stabilityWeights.rate', 0, 1);
  validateFinite(
    dynamics.confidenceWeights.base,
    'confidenceWeights.base',
    0,
    1,
  );
  validateFinite(
    dynamics.confidenceWeights.uncertaintyPenalty,
    'confidenceWeights.uncertaintyPenalty',
    0,
    1,
  );
  validateFinite(
    dynamics.confidenceWeights.memoryWithData,
    'confidenceWeights.memoryWithData',
    0,
    1,
  );
  validateFinite(
    dynamics.confidenceWeights.memoryWithoutData,
    'confidenceWeights.memoryWithoutData',
    0,
    1,
  );

  return Object.freeze({
    ...input,
    dynamics: Object.freeze(dynamics),
  }) as DeterministicModelParameters;
}
