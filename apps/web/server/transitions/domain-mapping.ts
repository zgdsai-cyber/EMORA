import {
  createEmotionalDimensions,
  createEmotionalEvent,
  createEmotionalState,
  createEventSource,
  createModelVersion,
  zeroEmotionVector,
} from '@emora/emotional-core';
import type { EmotionalState, ModelVersion } from '@emora/emotional-core';

import { INITIALIZATION_MARKER } from './disclosure';
import { TransitionError } from './errors';
import type { AcceptedTransitionRequest } from './validation';

/**
 * Slice 1 persistence<->domain mapping. Structural translation only; no
 * mathematical logic. Range and structure validation stays in the domain
 * constructors.
 */

export interface ModelVersionRow {
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export interface EmotionalStateRow {
  readonly state: unknown;
  readonly timestamp: Date;
  readonly modelVersionId: string;
}

function internalIntegrity(category: string): never {
  throw new TransitionError('internal_error', category);
}

export function toDomainModelVersion(row: ModelVersionRow): ModelVersion {
  try {
    return createModelVersion({
      id: row.id,
      name: row.name,
      version: row.version,
    });
  } catch {
    internalIntegrity('model_version_integrity');
  }
}

export function toDomainEvent(
  eventId: string,
  request: AcceptedTransitionRequest,
  timestamp: string,
) {
  try {
    return createEmotionalEvent({
      id: eventId,
      timestamp,
      source: createEventSource('api_transition'),
      valence: request.valence,
      intensity: request.intensity,
      relevance: request.relevance,
      surprise: request.surprise,
      uncertainty: request.uncertainty,
      ...(request.context ? { context: request.context } : {}),
    });
  } catch {
    // Transport validation should have rejected this; treat as internal defect.
    internalIntegrity('event_construction');
  }
}

export function toDomainState(
  row: EmotionalStateRow,
  modelVersion: ModelVersion,
): EmotionalState {
  const persisted = row.state;
  if (
    typeof persisted !== 'object' ||
    persisted === null ||
    Array.isArray(persisted)
  ) {
    internalIntegrity('state_integrity');
  }
  const candidate = persisted as {
    emotionVector?: unknown;
    dimensions?: unknown;
    metadata?: unknown;
  };
  try {
    return createEmotionalState({
      emotionVector: candidate.emotionVector as never,
      dimensions: candidate.dimensions as never,
      timestamp: row.timestamp.toISOString(),
      modelVersion,
      ...(candidate.metadata === undefined
        ? {}
        : {
            metadata: candidate.metadata as Readonly<Record<string, unknown>>,
          }),
    });
  } catch {
    internalIntegrity('state_integrity');
  }
}

/**
 * Computational zero-vector initialization used when a profile has no persisted
 * state. This is NOT a psychological baseline, NOT a measurement, and NOT an
 * observed or inferred human emotional state.
 */
export function toInitialComputationalState(
  timestamp: string,
  modelVersion: ModelVersion,
): EmotionalState {
  return createEmotionalState({
    emotionVector: zeroEmotionVector(),
    dimensions: createEmotionalDimensions({
      valence: 0,
      arousal: 0,
      intensity: 0,
      confidence: 0,
    }),
    timestamp,
    modelVersion,
    metadata: Object.freeze({ initialization: INITIALIZATION_MARKER }),
  });
}

export function stateToJson(state: EmotionalState): Record<string, unknown> {
  return {
    emotionVector: { ...state.emotionVector },
    dimensions: { ...state.dimensions },
    ...(state.metadata ? { metadata: { ...state.metadata } } : {}),
  };
}
