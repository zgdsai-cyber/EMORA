import { createEmotionalState, validateEmotionalState } from '../domain/emotional-state';
import { validateEmotionalEvent } from '../domain/emotional-event';
import { validatePersonalityProfile } from '../domain/personality-profile';
import { validateEmotionalMemory } from '../domain/emotional-memory';
import { emotionNames } from '../domain/emotion-vector';
import type { StateTransitionInput, StateTransitionResult } from '../transition/transition-types';
import { createDefaultModelParameters, validateModelParameters } from '../parameters/model-parameters';
import { extractEventFeatures } from './event-features';
import { calculateEventImpact } from './event-impact';
import { calculatePersonalityModifiers } from './personality-modulation';
import { calculateBaseEmotionInfluence } from './base-influence';
import { applyEmotionInteractions } from './emotion-interactions';
import { calculateMemoryInfluence } from './memory-influence';
import { applyTemporalStability } from './temporal-stability';
import { calculateContinuousDimensions } from './continuous-dimensions';
import type { EmotionInfluence } from './types';

function confidenceForTransition(memoryCount: number, uncertainty: number, base: number, memoryWithData: number, memoryWithoutData: number) {
  const completeness = 1;
  const uncertaintyFactor = 1 - uncertainty;
  const memoryFactor = memoryCount > 0 ? memoryWithData : memoryWithoutData;
  return Math.min(1, Math.max(0, base * completeness * uncertaintyFactor * memoryFactor));
}

export function calculateNextEmotionalState(input: StateTransitionInput): StateTransitionResult {
  validateEmotionalState(input.currentState);
  validateEmotionalEvent(input.event);
  validatePersonalityProfile(input.personalityProfile);
  for (const memory of input.memories ?? []) validateEmotionalMemory(memory);
  const parameters = validateModelParameters(input.modelParameters ?? createDefaultModelParameters());
  const features = extractEventFeatures(input.event);
  const eventImpact = calculateEventImpact(input.event, parameters);
  const personalityModifiers = calculatePersonalityModifiers(input.personalityProfile, parameters);
  const baseInfluence = calculateBaseEmotionInfluence(features, eventImpact, parameters);
  const modulatedInfluence = Object.fromEntries(
    emotionNames.map((emotion) => {
      const modifier = emotion === 'love'
        ? personalityModifiers.attachmentSensitivity
        : emotion === 'fear'
          ? personalityModifiers.baselineAnxiety
          : emotion === 'nostalgia'
            ? personalityModifiers.nostalgiaSensitivity
            : emotion === 'jealousy'
              ? personalityModifiers.jealousySensitivity
              : emotion === 'trust'
                ? personalityModifiers.baselineTrust
                : personalityModifiers.emotionalSensitivity;
      return [emotion, baseInfluence[emotion] * modifier];
    }),
  ) as EmotionInfluence;
  const interactionInfluence = applyEmotionInteractions(modulatedInfluence as never, parameters);
  const memoryInfluence = calculateMemoryInfluence(input.memories, input.currentState.emotionVector, input.event.timestamp, parameters);
  const combinedDelta = Object.fromEntries(
    emotionNames.map((emotion) => [
      emotion,
      modulatedInfluence[emotion] + interactionInfluence[emotion] + memoryInfluence[emotion],
    ]),
  ) as EmotionInfluence;
  const nextVector = applyTemporalStability(input.currentState.emotionVector, combinedDelta, parameters);
  const confidence = confidenceForTransition(
    input.memories?.length ?? 0,
    features.uncertainty * parameters.dynamics.confidenceWeights.uncertaintyPenalty,
    parameters.dynamics.confidenceWeights.base,
    parameters.dynamics.confidenceWeights.memoryWithData,
    parameters.dynamics.confidenceWeights.memoryWithoutData,
  );
  const dimensions = calculateContinuousDimensions(nextVector, features, confidence);
  const nextState = createEmotionalState({
    emotionVector: nextVector,
    dimensions,
    timestamp: input.event.timestamp,
    modelVersion: input.currentState.modelVersion,
    metadata: { ...input.currentState.metadata },
  });
  const explanationMetadata = Object.freeze({
    eventImpact,
    personalityModifiers: Object.freeze({ ...personalityModifiers }),
    baseInfluence: Object.freeze({ ...baseInfluence }),
    interactionInfluence: Object.freeze({ ...interactionInfluence }),
    memoryInfluence: Object.freeze({ ...memoryInfluence }),
    stabilityInfluence: Object.freeze(
      Object.fromEntries(emotionNames.map((emotion) => [
        emotion,
        parameters.dynamics.stabilityWeights.rate * (parameters.dynamics.stabilityWeights.baseline[emotion] - input.currentState.emotionVector[emotion]),
      ])),
    ),
    confidenceFactors: Object.freeze({ uncertainty: features.uncertainty, memoryCount: input.memories?.length ?? 0 }),
  });
  return Object.freeze({
    nextState,
    explanationMetadata,
    confidenceAdjustment: confidence - input.currentState.dimensions.confidence,
  });
}
