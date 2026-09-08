import { emotionNames } from '../domain/emotion-vector';
import type { EmotionName } from '../domain/emotion-vector';
import type {
} from '../domain/model-parameters';
import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { deepCloneAndFreeze } from '../utils/deep-immutable';
import { validateInteractionPolicy } from '../dynamics/interaction-policy';
import type { EmotionInteractionMatrix } from '../dynamics/types';

const personalityWeightNames = [
  'emotionalSensitivity',
  'baselineTrust',
  'baselineAnxiety',
  'attachmentSensitivity',
  'nostalgiaSensitivity',
  'jealousySensitivity',
] as const;

const confidenceWeightNames = [
  'base',
  'uncertaintyPenalty',
  'memoryWithData',
  'memoryWithoutData',
] as const;

const emotionCoefficientNames = [
  'positive',
  'negative',
  'uncertainty',
  'relevance',
  'surprise',
] as const;

export type LearnableEmotionCoefficient = Readonly<
  Record<(typeof emotionCoefficientNames)[number], number>
>;

export type LearnableEmotionWeights = Readonly<
  Record<EmotionName, LearnableEmotionCoefficient>
>;

export interface LearnableParameterValues {
  readonly eventImpactWeights: Readonly<{
    readonly surpriseBase: number;
    readonly surpriseScale: number;
  }>;
  readonly personalityWeights: Readonly<
    Record<(typeof personalityWeightNames)[number], number>
  >;
  readonly emotionWeights: LearnableEmotionWeights;
  readonly memoryWeights: Readonly<Record<EmotionName, number>>;
  readonly memoryDecayRate: number;
  readonly stabilityWeights: Readonly<{
    readonly rate: number;
    readonly baseline: Readonly<Record<EmotionName, number>>;
  }>;
  readonly confidenceWeights: Readonly<
    Record<(typeof confidenceWeightNames)[number], number>
  >;
}

export interface FixedLearnableParameterValues {
  readonly policyVersion: string;
  readonly interactionWeights: EmotionInteractionMatrix;
}

export interface LearnableParameterSet {
  readonly version: string;
  readonly learnable: LearnableParameterValues;
  readonly fixed: FixedLearnableParameterValues;
}

function invalid(message: string): never {
  throw new InvalidDomainObjectError(`Learnable parameter set ${message}`);
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: unknown,
  name: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  const object = requireObject(value, name);
  const actualKeys = Object.keys(object).sort();
  const canonicalKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== canonicalKeys.length ||
    actualKeys.some((key, index) => key !== canonicalKeys[index])
  ) {
    return invalid(`${name} must contain exactly: ${expectedKeys.join(', ')}.`);
  }
  return object;
}

function requireFiniteNumber(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    return invalid(`${name} must be a finite number in [${minimum}, ${maximum}].`);
  }
  return value;
}

function validateBoundedRecord(
  value: unknown,
  name: string,
  keys: readonly string[],
  minimum: number,
  maximum: number,
): void {
  const object = requireExactKeys(value, name, keys);
  for (const key of keys) {
    requireFiniteNumber(object[key], `${name}.${key}`, minimum, maximum);
  }
}

function validateEmotionWeights(value: unknown): void {
  const weights = requireExactKeys(value, 'learnable.emotionWeights', emotionNames);
  for (const emotion of emotionNames) {
    validateBoundedRecord(
      weights[emotion],
      `learnable.emotionWeights.${emotion}`,
      emotionCoefficientNames,
      0,
      2,
    );
  }
  if ((weights.trust as Record<string, number>).negative !== 0) {
    invalid('emotionWeights.trust.negative must remain zero.');
  }
}

function validateInteractionWeights(value: unknown): EmotionInteractionMatrix {
  const matrix = requireExactKeys(
    value,
    'fixed.interactionWeights',
    emotionNames,
  ) as EmotionInteractionMatrix;
  validateInteractionPolicy(matrix);
  return matrix;
}

export function createLearnableParameterSet(
  input: LearnableParameterSet,
): LearnableParameterSet {
  const root = requireExactKeys(input, 'root', ['version', 'learnable', 'fixed']);
  if (typeof root.version !== 'string' || root.version.trim().length === 0) {
    invalid('version must be a non-empty string.');
  }

  const learnable = requireExactKeys(root.learnable, 'learnable', [
    'eventImpactWeights',
    'personalityWeights',
    'emotionWeights',
    'memoryWeights',
    'memoryDecayRate',
    'stabilityWeights',
    'confidenceWeights',
  ]);
  validateBoundedRecord(
    learnable.eventImpactWeights,
    'learnable.eventImpactWeights',
    ['surpriseBase', 'surpriseScale'],
    0,
    1,
  );
  validateBoundedRecord(
    learnable.personalityWeights,
    'learnable.personalityWeights',
    personalityWeightNames,
    0,
    2,
  );
  validateEmotionWeights(learnable.emotionWeights);
  validateBoundedRecord(
    learnable.memoryWeights,
    'learnable.memoryWeights',
    emotionNames,
    0,
    1,
  );
  requireFiniteNumber(learnable.memoryDecayRate, 'learnable.memoryDecayRate', 0, 1);

  const stability = requireExactKeys(
    learnable.stabilityWeights,
    'learnable.stabilityWeights',
    ['rate', 'baseline'],
  );
  requireFiniteNumber(stability.rate, 'learnable.stabilityWeights.rate', 0, 1);
  validateBoundedRecord(
    stability.baseline,
    'learnable.stabilityWeights.baseline',
    emotionNames,
    0,
    1,
  );
  validateBoundedRecord(
    learnable.confidenceWeights,
    'learnable.confidenceWeights',
    confidenceWeightNames,
    0,
    1,
  );

  const fixed = requireExactKeys(root.fixed, 'fixed', [
    'policyVersion',
    'interactionWeights',
  ]);
  if (typeof fixed.policyVersion !== 'string' || fixed.policyVersion.trim().length === 0) {
    invalid('fixed.policyVersion must be a non-empty string.');
  }
  validateInteractionWeights(fixed.interactionWeights);

  return deepCloneAndFreeze(input);
}
