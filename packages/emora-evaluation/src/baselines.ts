import {
  createEmotionVector,
  createEmotionalDimensions,
  createEmotionalState,
  emotionNames,
} from '@emora/emotional-core';
import type {
  StateTransitionInput,
  StateTransitionProvider,
  StateTransitionResult,
} from '@emora/emotional-core';

import { DIMENSION_REGISTRY } from './dimensions/registry';
import type { ConstantBaselineDefinition } from './contracts';

const behavioralDimensionIds = DIMENSION_REGISTRY.filter(
  (definition) => definition.behavioralTarget,
).map((definition) => definition.dimensionId);

function assertConstantValues(definition: ConstantBaselineDefinition): void {
  for (const dimension of behavioralDimensionIds) {
    const value = definition.values[dimension];
    const definitionForDimension = DIMENSION_REGISTRY.find(
      (item) => item.dimensionId === dimension,
    );
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !definitionForDimension ||
      value < definitionForDimension.range[0] ||
      value > definitionForDimension.range[1]
    ) {
      throw new Error(
        `Constant baseline value is invalid for dimension ${dimension}.`,
      );
    }
  }
  for (const dimension of Object.keys(definition.values)) {
    if (!behavioralDimensionIds.includes(dimension)) {
      throw new Error(
        `Constant baseline dimension is not a behavioral target: ${dimension}.`,
      );
    }
  }
}

export function createConstantBaselineProvider(
  definition: ConstantBaselineDefinition,
): StateTransitionProvider {
  assertConstantValues(definition);
  const values = Object.freeze({ ...definition.values });
  const modelVersion = {
    id: `baseline:${definition.baselineId}`,
    name: definition.baselineId,
    version: definition.baselineVersion,
  } as const;
  return {
    identifier: `baseline:${definition.baselineId}`,
    modelVersion,
    transition(input: StateTransitionInput): StateTransitionResult {
      const emotionVector = createEmotionVector(
        Object.fromEntries(
          emotionNames.map((emotion) => [emotion, values[emotion]]),
        ),
      );
      const dimensions = createEmotionalDimensions({
        valence: values.valence,
        arousal: values.arousal,
        intensity: values.intensity,
        // Confidence is computational, not a baseline behavioral target.
        confidence: input.currentState.dimensions.confidence,
      });
      return {
        nextState: createEmotionalState({
          emotionVector,
          dimensions,
          timestamp: input.event.timestamp,
          modelVersion,
          metadata: {
            baselineId: definition.baselineId,
            baselineVersion: definition.baselineVersion,
          },
        }),
        explanationMetadata: {
          baselineId: definition.baselineId,
          baselineVersion: definition.baselineVersion,
        },
        confidenceAdjustment: 0,
      };
    },
  };
}
